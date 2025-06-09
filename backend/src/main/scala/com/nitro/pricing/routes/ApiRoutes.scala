package com.nitro.pricing.routes

import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.Route
import org.apache.pekko.http.scaladsl.model.StatusCodes
import org.apache.pekko.http.scaladsl.model.headers.{`Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Origin`}
import org.apache.pekko.http.scaladsl.model.HttpMethods._
import org.mdedetrich.pekko.http.support.CirceHttpSupport._
import com.nitro.pricing.services.{ChargebeeClient, TaxCalculationService, PricingService}
import com.nitro.pricing.models.JsonCodecs._
import com.nitro.pricing.models.{HealthResponse, ServiceStatus}
import com.typesafe.scalalogging.LazyLogging
import io.circe._
import scala.concurrent.ExecutionContext
import scala.util.{Failure, Success}

class ApiRoutes(
  chargebeeClient: ChargebeeClient,
  taxService: TaxCalculationService,
  pricingService: PricingService
)(implicit ec: ExecutionContext) extends LazyLogging {

  // CORS configuration for frontend integration
  private val corsHeaders = Seq(
    `Access-Control-Allow-Origin`.*,
    `Access-Control-Allow-Methods`(GET, POST, PUT, DELETE, OPTIONS),
    `Access-Control-Allow-Headers`("Content-Type", "Authorization")
  )

  val routes: Route = respondWithHeaders(corsHeaders) {
    pathPrefix("api") {
      concat(
        pricingRoutes,
        discoveryRoutes,
        healthRoutes,
        corsRoute
      )
    }
  }

  private val corsRoute: Route = {
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

  private val healthRoutes: Route = {
    path("health") {
      get {
        logger.debug("Health check request received")
        
        val chargebeeHealth = chargebeeClient.testConnection()
        
        onComplete(chargebeeHealth) {
          case Success(isHealthy) =>
            val status = if (isHealthy) StatusCodes.OK else StatusCodes.ServiceUnavailable
            
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
