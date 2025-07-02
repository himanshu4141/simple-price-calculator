package com.nitro.pricing.routes

import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.Route
import org.apache.pekko.http.scaladsl.model.StatusCodes
import org.apache.pekko.http.scaladsl.model.headers.{`Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Origin`}
import org.apache.pekko.http.scaladsl.model.HttpMethods._
import org.apache.pekko.http.scaladsl.server.directives.RouteDirectives.reject
import org.apache.pekko.http.scaladsl.server.{Rejection, RejectionHandler}
import org.mdedetrich.pekko.http.support.CirceHttpSupport._
import com.nitro.pricing.services.{ChargebeeClient, TaxCalculationService, PricingService, CheckoutService, StripeClient}
import com.nitro.pricing.models.JsonCodecs._
import com.nitro.pricing.models.{HealthResponse, ServiceStatus, PricingEstimateRequest, PricingEstimateItemRequest, TaxRequest, CheckoutRequest, FrontendTaxRequest, Address, TaxLineItem, Money}
import com.typesafe.scalalogging.LazyLogging
import io.circe._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}

class ApiRoutes(
  chargebeeClient: ChargebeeClient,
  taxService: TaxCalculationService,
  pricingService: PricingService,
  checkoutService: CheckoutService,
  stripeClient: StripeClient // <--- inject StripeClient here
)(implicit ec: ExecutionContext) extends LazyLogging {

  // CORS configuration for frontend integration
  private val corsHeaders = List(
    `Access-Control-Allow-Origin`.*,
    `Access-Control-Allow-Methods`(GET, POST, PUT, DELETE, OPTIONS),
    `Access-Control-Allow-Headers`("Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With", "X-API-Key")
  )

  // Enhanced rejection handler that ensures CORS headers are always added
  private val corsRejectionHandler = RejectionHandler.newBuilder()
    .handleAll[Rejection] { rejections =>
      logger.debug(s"Handling rejections with CORS headers: ${rejections.map(_.getClass.getSimpleName)}")
      respondWithHeaders(corsHeaders) {
        RejectionHandler.default(rejections).getOrElse(complete(StatusCodes.NotFound, "Not Found"))
      }
    }
    .result()

  // Wrap all routes with CORS headers and rejection handling
  private def addCorsHeaders(route: Route): Route = {
    extractRequest { request =>
      logger.debug(s"Processing request: ${request.method.value} ${request.uri}")
      handleRejections(corsRejectionHandler) {
        respondWithHeaders(corsHeaders) {
          route
        }
      }
    }
  }

  val routes: Route = addCorsHeaders {
    // Add a root route for basic connectivity testing
    pathEndOrSingleSlash {
      get {
        complete(StatusCodes.OK, "Nitro Price Calculator API is running")
      }
    } ~
    pathPrefix("api") {
      concat(
        corsRoute,
        pricingRoutes,
        estimateRoutes,
        taxRoutes,
        checkoutRoutes,
        discoveryRoutes,
        paymentRoutes, // <--- include payment routes here
        healthRoutes
      )
    }
  }

  private val corsRoute: Route = {
    pathEndOrSingleSlash {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("pricing") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("estimate") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("taxes") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("checkout") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    path("create-portal-session") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("chargebee") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    pathPrefix("health") {
      options {
        complete(StatusCodes.OK)
      }
    } ~
    options {
      complete(StatusCodes.OK)
    }
  }

  private val pricingRoutes: Route = {
    path("pricing") {
      get {
        parameter("currency".optional) { currencyOpt =>
          val currency = currencyOpt.getOrElse("USD")
          logger.info(s"Pricing request received for currency: $currency")
          
          onComplete(pricingService.getPricing(currency)) {
            case Success(pricingResponse) =>
              logger.info(s"Pricing response successful: ${pricingResponse.productFamilies.length} product families")
              complete(StatusCodes.OK, pricingResponse)
              
            case Failure(ex) =>
              logger.error("Pricing request failed", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Failed to fetch pricing"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.InternalServerError, errorResponse)
          }
        }
      }
    }
  }

  private val estimateRoutes: Route = {
    path("estimate") {
      post {
        entity(as[PricingEstimateRequest]) { request =>
          logger.info(s"Estimate request received: ${request.items.length} items, currency: ${request.currency}, term: ${request.billingTerm}")
          
          onComplete(pricingService.calculateEstimate(request)) {
            case Success(estimateResponse) =>
              logger.info(s"Estimate calculated successfully: subtotal ${estimateResponse.subtotal}, total ${estimateResponse.total}")
              complete(StatusCodes.OK, estimateResponse)
              
            case Failure(ex) =>
              logger.error("Estimate calculation failed", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Failed to calculate estimate"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.BadRequest, errorResponse)
          }
        }
      }
    }
  }

  // Convert frontend tax request to backend format using actual pricing
  private def convertFrontendTaxRequestAsync(frontendRequest: FrontendTaxRequest): Future[TaxRequest] = {
    val backendAddress = Address(
      line1 = frontendRequest.customerAddress.line1,
      line2 = frontendRequest.customerAddress.line2,
      city = frontendRequest.customerAddress.city,
      state = frontendRequest.customerAddress.state,
      postalCode = frontendRequest.customerAddress.zip, // Convert zip to postalCode
      country = frontendRequest.customerAddress.country
    )
    
    // Convert frontend items to estimate request to get actual pricing
    val estimateItems = frontendRequest.items.map { item =>
      PricingEstimateItemRequest(
        productFamily = item.productFamily,
        planName = item.planName,
        seats = item.seats,
        packages = item.packages,
        apiCalls = item.apiCalls
      )
    }
    
    val estimateRequest = PricingEstimateRequest(
      items = estimateItems,
      currency = frontendRequest.currency,
      billingTerm = "1year" // Use 1year for tax calculations
    )
    
    // Get actual pricing from the pricing service
    pricingService.calculateEstimate(estimateRequest).map { estimateResponse =>
      val backendLineItems = estimateResponse.items.map { item =>
        TaxLineItem(
          description = s"${item.planName} - ${item.productFamily}",
          amount = Money(item.totalPrice, frontendRequest.currency),
          taxable = true
        )
      }
      
      TaxRequest(
        customerAddress = backendAddress,
        lineItems = backendLineItems,
        currency = frontendRequest.currency
      )
    }
  }

  private val taxRoutes: Route = {
    path("taxes") {
      post {
        // Try to parse as FrontendTaxRequest first (for Angular frontend)
        entity(as[FrontendTaxRequest]) { frontendRequest =>
          logger.info(s"Frontend tax calculation request received for ${frontendRequest.customerAddress.country}, ${frontendRequest.items.length} items")
          
          onComplete(convertFrontendTaxRequestAsync(frontendRequest)) {
            case Success(backendRequest) =>
              onComplete(taxService.calculateTax(backendRequest)) {
                case Success(taxResponse) =>
                  logger.info(s"Tax calculation successful: total tax ${taxResponse.totalTax.amount} ${taxResponse.totalTax.currency}")
                  complete(StatusCodes.OK, taxResponse)
                  
                case Failure(ex) =>
                  logger.error("Tax calculation failed", ex)
                  val errorResponse = Json.obj(
                    "error" -> Json.fromString("Failed to calculate tax"),
                    "message" -> Json.fromString(ex.getMessage)
                  )
                  complete(StatusCodes.BadRequest, errorResponse)
              }
            case Failure(ex) =>
              logger.error("Failed to convert frontend tax request", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Failed to process tax request"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.BadRequest, errorResponse)
          }
        } ~
        // Fallback to original TaxRequest format for backward compatibility
        entity(as[TaxRequest]) { request =>
          logger.info(s"Backend tax calculation request received for ${request.customerAddress.country}, ${request.lineItems.length} items")
          
          onComplete(taxService.calculateTax(request)) {
            case Success(taxResponse) =>
              logger.info(s"Tax calculation successful: total tax ${taxResponse.totalTax.amount} ${taxResponse.totalTax.currency}")
              complete(StatusCodes.OK, taxResponse)
              
            case Failure(ex) =>
              logger.error("Tax calculation failed", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Failed to calculate tax"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.BadRequest, errorResponse)
          }
        }
      }
    }
  }

  private val checkoutRoutes: Route = {
    path("checkout") {
      post {
        entity(as[CheckoutRequest]) { request =>
          logger.info(s"Checkout request received for customer: ${request.customer.email}, ${request.items.length} items, term: ${request.billingTerm}")
          
          onComplete(checkoutService.processCheckout(request)) {
            case Success(checkoutResponse) =>
              if (checkoutResponse.success) {
                if (checkoutResponse.salesContactRequired) {
                  logger.info(s"Checkout requires sales contact for ${request.customer.email}")
                  complete(StatusCodes.Accepted, checkoutResponse)
                } else {
                  logger.info(s"Checkout completed successfully for customer: ${checkoutResponse.customerId}")
                  complete(StatusCodes.Created, checkoutResponse)
                }
              } else {
                logger.warn(s"Checkout failed for ${request.customer.email}: ${checkoutResponse.message}")
                complete(StatusCodes.BadRequest, checkoutResponse)
              }
              
            case Failure(ex) =>
              logger.error(s"Checkout processing failed for ${request.customer.email}", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Checkout processing failed"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.InternalServerError, errorResponse)
          }
        }
      }
    } ~
    path("create-portal-session") {
      post {
        entity(as[String]) { body =>
          import io.circe.parser._
          decode[Json](body) match {
            case Right(json) =>
              json.hcursor.get[String]("customerId") match {
                case Right(customerId) =>
                  logger.info(s"Portal session request received for customer: $customerId")
                  
                  onComplete(chargebeeClient.createPortalSession(customerId)) {
                    case Success(Left(error)) =>
                      logger.error(s"Portal session creation failed for customer $customerId: $error")
                      val errorResponse = Json.obj(
                        "success" -> Json.fromBoolean(false),
                        "error" -> Json.fromString(error)
                      )
                      complete(StatusCodes.BadRequest, errorResponse)
                      
                    case Success(Right(portalSession)) =>
                      logger.info(s"Portal session created successfully for customer $customerId: ${portalSession.id}")
                      logger.info(s"🔗 Fresh portal session URL: ${portalSession.access_url}")
                      val successResponse = Json.obj(
                        "success" -> Json.fromBoolean(true),
                        "portalSessionUrl" -> Json.fromString(portalSession.access_url),
                        "portalSessionId" -> Json.fromString(portalSession.id)
                      )
                      complete(StatusCodes.OK, successResponse)
                      
                    case Failure(ex) =>
                      logger.error(s"Portal session creation failed for customer $customerId", ex)
                      val errorResponse = Json.obj(
                        "success" -> Json.fromBoolean(false),
                        "error" -> Json.fromString(ex.getMessage)
                      )
                      complete(StatusCodes.InternalServerError, errorResponse)
                  }
                  
                case Left(_) =>
                  val errorResponse = Json.obj(
                    "success" -> Json.fromBoolean(false),
                    "error" -> Json.fromString("Missing customerId in request body")
                  )
                  complete(StatusCodes.BadRequest, errorResponse)
              }
              
            case Left(_) =>
              val errorResponse = Json.obj(
                "success" -> Json.fromBoolean(false),
                "error" -> Json.fromString("Invalid JSON in request body")
              )
              complete(StatusCodes.BadRequest, errorResponse)
          }
        }
      }
    }
  }

  private val discoveryRoutes: Route = {
    pathPrefix("chargebee") {
      path("discovery") {
        get {
          logger.info("Chargebee discovery request received")
          
          onComplete(chargebeeClient.getProductStructure()) {
            case Success(discovery) =>
              logger.info(s"Discovery successful: ${discovery.items.length} items, ${discovery.itemPrices.length} item prices")
              complete(StatusCodes.OK, discovery)
              
            case Failure(ex) =>
              logger.error("Discovery failed", ex)
              val errorResponse = Json.obj(
                "error" -> Json.fromString("Discovery failed"),
                "message" -> Json.fromString(ex.getMessage)
              )
              complete(StatusCodes.InternalServerError, errorResponse)
          }
        }
      }
    }
  }

  private val paymentRoutes: Route = new PaymentRoutes(stripeClient).routes

  private val healthRoutes: Route = {
    path("health") {
      get {
        logger.info("Health check request received")
        
        val chargebeeHealth = chargebeeClient.testConnection()
        
        onComplete(chargebeeHealth) {
          case Success(isHealthy) =>
            val status = if (isHealthy) StatusCodes.OK else StatusCodes.ServiceUnavailable
            logger.info(s"Health check completed - Chargebee: ${if (isHealthy) "healthy" else "unhealthy"}")
            
            val healthResponse = HealthResponse(
              status = if (isHealthy) "healthy" else "unhealthy",
              services = ServiceStatus(
                chargebee = if (isHealthy) "connected" else "failed",
                taxService = "mock-ready", // Mock is always ready
                stripe = "not-tested" // Will test when we implement Stripe
              ),
              timestamp = java.time.Instant.now().toString
            )
            
            complete(status, healthResponse)
            
          case Failure(ex) =>
            logger.error("Health check failed", ex)
            val healthResponse = HealthResponse(
              status = "unhealthy",
              services = ServiceStatus(
                chargebee = "failed",
                taxService = "mock-ready",
                stripe = "not-tested"
              ),
              timestamp = java.time.Instant.now().toString,
              error = Some(ex.getMessage)
            )
            
            complete(StatusCodes.ServiceUnavailable, healthResponse)
        }
      }
    }
  }
}
