package com.nitro.pricing.services

import com.nitro.pricing.config.ChargebeeConfig
import com.nitro.pricing.models._
import com.nitro.pricing.models.JsonCodecs._
import com.typesafe.scalalogging.LazyLogging
import sttp.client3._
import sttp.client3.circe._
import io.circe._

import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import java.util.Base64

class ChargebeeClient(config: ChargebeeConfig)(implicit ec: ExecutionContext, backend: SttpBackend[Future, _]) extends LazyLogging {
  
  private val apiKey = config.apiKey
  private val siteName = config.site
  private val gatewayAccountId = config.gatewayAccountId
  private val baseUri = uri"https://$siteName.chargebee.com/api/v2"
  private val authHeader = "Basic " + Base64.getEncoder.encodeToString(s"$apiKey:".getBytes)

  logger.info(s"ChargebeeClient initialized with site: $siteName, gateway: $gatewayAccountId")

  def testConnection(): Future[Boolean] = {
    logger.info(s"Testing Chargebee connection to site: $siteName")
    val request = basicRequest
      .get(baseUri.addPath("items").addParam("limit", "1"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/json")
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          logger.info(s"✅ Chargebee connection successful to site: $siteName")
          logger.debug(s"Response: ${json.spaces2}")
          true
        case Left(error) =>
          logger.error(s"❌ Chargebee connection failed: $error")
          false
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Chargebee connection error: ${ex.getMessage}")
        false
    }
  }

  def listItems(): Future[List[ChargebeeItem]] = {
    logger.info("Fetching all Chargebee items with pagination...")
    fetchAllItems(None, List.empty)
  }

  def listItemPrices(): Future[List[ChargebeeItemPrice]] = {
    logger.info("Fetching all Chargebee item prices with pagination...")
    fetchAllItemPrices(None, List.empty)
  }

  private def fetchAllItems(offset: Option[String], accumulated: List[ChargebeeItem]): Future[List[ChargebeeItem]] = {
    val requestUri = offset match {
      case Some(offsetValue) => baseUri.addPath("items").addParam("offset", offsetValue)
      case None => baseUri.addPath("items")
    }
    
    val request = basicRequest
      .get(requestUri)
      .header("Authorization", authHeader)
      .header("Content-Type", "application/json")
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).flatMap { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("list").as[List[Json]] match {
            case Right(itemsList) =>
              val items = itemsList.flatMap { itemWrapper =>
                itemWrapper.hcursor.downField("item").as[ChargebeeItem] match {
                  case Right(item) => 
                    logger.debug(s"✅ Parsed item: ${item.id} - ${item.name}")
                    Some(item)
                  case Left(error) => 
                    logger.warn(s"❌ Failed to parse item: $error")
                    None
                }
              }
              
              val newAccumulated = accumulated ++ items
              logger.info(s"📦 Fetched ${items.length} items (total: ${newAccumulated.length})")
              
              // Check for pagination
              json.hcursor.downField("next_offset").as[String] match {
                case Right(nextOffset) =>
                  logger.info(s"🔄 More items available, fetching next page with offset: $nextOffset")
                  fetchAllItems(Some(nextOffset), newAccumulated)
                case Left(_) =>
                  logger.info(s"✅ All items fetched. Total: ${newAccumulated.length}")
                  Future.successful(newAccumulated)
              }
              
            case Left(error) =>
              logger.error(s"❌ Failed to parse items list: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Future.successful(accumulated)
          }
        case Left(error) =>
          logger.error(s"❌ Failed to fetch items: $error")
          Future.successful(accumulated)
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error fetching items: ${ex.getMessage}")
        accumulated
    }
  }

  private def fetchAllItemPrices(offset: Option[String], accumulated: List[ChargebeeItemPrice]): Future[List[ChargebeeItemPrice]] = {
    val requestUri = offset match {
      case Some(offsetValue) => baseUri.addPath("item_prices").addParam("offset", offsetValue)
      case None => baseUri.addPath("item_prices")
    }
    
    val request = basicRequest
      .get(requestUri)
      .header("Authorization", authHeader)
      .header("Content-Type", "application/json")
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).flatMap { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("list").as[List[Json]] match {
            case Right(pricesList) =>
              val itemPrices = pricesList.flatMap { priceWrapper =>
                priceWrapper.hcursor.downField("item_price").as[ChargebeeItemPrice] match {
                  case Right(itemPrice) => 
                    logger.debug(s"✅ Parsed item price: ${itemPrice.id} - ${itemPrice.name}")
                    Some(itemPrice)
                  case Left(error) => 
                    logger.warn(s"❌ Failed to parse item price: $error")
                    None
                }
              }
              
              val newAccumulated = accumulated ++ itemPrices
              logger.info(s"💰 Fetched ${itemPrices.length} item prices (total: ${newAccumulated.length})")
              
              // Check for pagination
              json.hcursor.downField("next_offset").as[String] match {
                case Right(nextOffset) =>
                  logger.info(s"🔄 More item prices available, fetching next page with offset: $nextOffset")
                  fetchAllItemPrices(Some(nextOffset), newAccumulated)
                case Left(_) =>
                  logger.info(s"✅ All item prices fetched. Total: ${newAccumulated.length}")
                  Future.successful(newAccumulated)
              }
              
            case Left(error) =>
              logger.error(s"❌ Failed to parse item prices list: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Future.successful(accumulated)
          }
        case Left(error) =>
          logger.error(s"❌ Failed to fetch item prices: $error")
          Future.successful(accumulated)
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error fetching item prices: ${ex.getMessage}")
        accumulated
    }
  }

  def createCustomer(customer: Customer, billingAddress: BillingAddress): Future[Either[String, ChargebeeCustomer]] = {
    logger.info(s"Creating Chargebee customer: ${customer.email}")
    
    val requestBody = Map(
      "first_name" -> customer.firstName,
      "last_name" -> customer.lastName,
      "email" -> customer.email
    ) ++ customer.company.map("company" -> _).toMap ++
      customer.phone.map("phone" -> _).toMap ++
      Map(
        "billing_address[first_name]" -> billingAddress.firstName,
        "billing_address[last_name]" -> billingAddress.lastName,
        "billing_address[line1]" -> billingAddress.line1,
        "billing_address[city]" -> billingAddress.city,
        "billing_address[state]" -> billingAddress.state,
        "billing_address[zip]" -> billingAddress.postalCode,
        "billing_address[country]" -> billingAddress.country
      ) ++ billingAddress.line2.map("billing_address[line2]" -> _).toMap ++
        billingAddress.company.map("billing_address[company]" -> _).toMap

    val request = basicRequest
      .post(baseUri.addPath("customers"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(requestBody.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("customer").as[ChargebeeCustomer] match {
            case Right(chargebeeCustomer) =>
              logger.info(s"✅ Customer created successfully: ${chargebeeCustomer.id}")
              Right(chargebeeCustomer)
            case Left(error) =>
              logger.error(s"❌ Failed to parse customer response: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Left(s"Failed to parse customer response: $error")
          }
        case Left(error) =>
          logger.error(s"❌ Failed to create customer: $error")
          Left(s"Failed to create customer: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating customer: ${ex.getMessage}")
        Left(s"Error creating customer: ${ex.getMessage}")
    }
  }

  def createSubscription(customerId: String, items: List[CheckoutItem]): Future[Either[String, ChargebeeSubscription]] = {
    logger.info(s"Creating Chargebee subscription for customer: $customerId with ${items.length} items")
    
    val itemParams = items.zipWithIndex.flatMap { case (item, index) =>
      Map(
        s"subscription_items[item_price_id][$index]" -> item.itemPriceId,
        s"subscription_items[quantity][$index]" -> item.quantity.toString
        // Note: Omitting billing_cycles to use default behavior (infinite recurring)
      )
    }.toMap

    val request = basicRequest
      .post(baseUri.addPath("customers").addPath(customerId).addPath("subscription_for_items"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(itemParams.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("subscription").as[ChargebeeSubscription] match {
            case Right(subscription) =>
              logger.info(s"✅ Subscription created successfully: ${subscription.id}")
              Right(subscription)
            case Left(error) =>
              logger.error(s"❌ Failed to parse subscription response: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Left(s"Failed to parse subscription response: $error")
          }
        case Left(error) =>
          logger.error(s"❌ Failed to create subscription: $error")
          Left(s"Failed to create subscription: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating subscription: ${ex.getMessage}")
        Left(s"Error creating subscription: ${ex.getMessage}")
    }
  }

  def attachPaymentMethodToCustomer(customerId: String, stripePaymentMethodId: String): Future[Either[String, String]] = {
    logger.info(s"Attaching Stripe payment method $stripePaymentMethodId to Chargebee customer: $customerId")
    
    val requestBody = Map(
      "type" -> "card",
      "gateway" -> gatewayAccountId,
      "customer_id" -> customerId,
      "tmp_token" -> stripePaymentMethodId
    )

    val request = basicRequest
      .post(baseUri.addPath("payment_sources"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(requestBody.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("payment_source").as[Json] match {
            case Right(paymentSource) =>
              val paymentSourceId = paymentSource.hcursor.downField("id").as[String].getOrElse("unknown")
              logger.info(s"✅ Payment source attached successfully: $paymentSourceId")
              Right(paymentSourceId)
            case Left(error) =>
              logger.error(s"❌ Failed to parse payment source response: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Left(s"Failed to parse payment source response: $error")
          }
        case Left(error) =>
          logger.error(s"❌ Failed to attach payment method: $error")
          Left(s"Failed to attach payment method: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error attaching payment method: ${ex.getMessage}")
        Left(s"Error attaching payment method: ${ex.getMessage}")
    }
  }

  def createSubscriptionWithPayment(customerId: String, items: List[CheckoutItem], paymentMethodId: Option[String] = None, stripeToken: Option[String] = None): Future[Either[String, ChargebeeSubscription]] = {
    logger.info(s"Creating Chargebee subscription with payment for customer: $customerId with ${items.length} items")
    
    val itemParams = items.zipWithIndex.flatMap { case (item, index) =>
      Map(
        s"subscription_items[item_price_id][$index]" -> item.itemPriceId,
        s"subscription_items[quantity][$index]" -> item.quantity.toString
      )
    }.toMap

    // Add payment method or Stripe token
    val paymentParams = (paymentMethodId, stripeToken) match {
      case (Some(pmId), _) => 
        logger.info(s"Using existing payment method ID: $pmId")
        Map(
          "card[gateway]" -> gatewayAccountId,
          "card[payment_method_id]" -> pmId
        )
      case (None, Some(token)) => 
        logger.info(s"Creating subscription with Stripe token: $token")
        // Try different parameter format based on Chargebee documentation
        Map(
          "card[gateway]" -> gatewayAccountId,
          "card[tmp_token]" -> token
        )
      case (None, None) => 
        logger.info("Creating subscription without payment method")
        Map.empty[String, String]
    }

    val allParams = itemParams ++ paymentParams
    
    // Debug log the complete request parameters
    logger.info(s"Subscription creation parameters: ${allParams.mkString(", ")}")

    val request = basicRequest
      .post(baseUri.addPath("customers").addPath(customerId).addPath("subscription_for_items"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(allParams.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)
      
    logger.info(s"Sending subscription creation request to: ${baseUri.addPath("customers").addPath(customerId).addPath("subscription_for_items")}")
    logger.info(s"Request body: ${allParams.map { case (k, v) => s"$k=$v" }.mkString("&")}")

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          json.hcursor.downField("subscription").as[ChargebeeSubscription] match {
            case Right(subscription) =>
              logger.info(s"✅ Subscription with payment created successfully: ${subscription.id}")
              Right(subscription)
            case Left(error) =>
              logger.error(s"❌ Failed to parse subscription response: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Left(s"Failed to parse subscription response: $error")
          }
        case Left(error) =>
          logger.error(s"❌ Failed to create subscription with payment: $error")
          Left(s"Failed to create subscription with payment: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating subscription with payment: ${ex.getMessage}")
        Left(s"Error creating subscription with payment: ${ex.getMessage}")
    }
  }

  def createSubscriptionWithPaymentIntent(customerId: String, items: List[CheckoutItem], paymentIntentId: String): Future[Either[String, ChargebeeSubscription]] = {
    logger.info(s"Creating Chargebee subscription with PaymentIntent for customer: $customerId, PaymentIntent: $paymentIntentId")
    
    val itemParams = items.zipWithIndex.flatMap { case (item, index) =>
      Map(
        s"subscription_items[item_price_id][$index]" -> item.itemPriceId,
        s"subscription_items[quantity][$index]" -> item.quantity.toString
      )
    }.toMap

    // Use PaymentIntent flow as per Chargebee's official sample
    val paymentParams = Map(
      "payment_intent[gateway_account_id]" -> gatewayAccountId,
      "payment_intent[gw_token]" -> paymentIntentId
    )

    val allParams = itemParams ++ paymentParams
    
    // Debug log the complete request parameters
    logger.info(s"Subscription creation with PaymentIntent parameters: ${allParams.mkString(", ")}")

    val request = basicRequest
      .post(baseUri.addPath("customers").addPath(customerId).addPath("subscription_for_items"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(allParams.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)
      
    logger.info(s"Sending subscription creation request to: ${baseUri.addPath("customers").addPath(customerId).addPath("subscription_for_items")}")
    logger.info(s"Request body: ${allParams.map { case (k, v) => s"$k=$v" }.mkString("&")}")

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          logger.info(s"Raw Chargebee subscription response: ${json.spaces2}")
          json.hcursor.downField("subscription").as[ChargebeeSubscription] match {
            case Right(subscription) =>
              logger.info(s"✅ Subscription with PaymentIntent created successfully: ${subscription.id}")
              Right(subscription)
            case Left(error) =>
              logger.error(s"❌ Failed to parse subscription response: $error")
              logger.debug(s"Raw JSON: ${json.spaces2}")
              Left(s"Failed to parse subscription response: $error")
          }
        case Left(error) =>
          logger.error(s"❌ Failed to create subscription with PaymentIntent: $error")
          Left(s"Failed to create subscription with PaymentIntent: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating subscription with PaymentIntent: ${ex.getMessage}")
        Left(s"Error creating subscription with PaymentIntent: ${ex.getMessage}")
    }
  }

  /**
   * Create an estimate for subscription with items using Chargebee's estimate API
   * This gives us the exact amount that will be charged including taxes
   */
  def createSubscriptionEstimate(
    customerId: String,
    items: List[CheckoutItem],
    billingAddress: BillingAddress,
    currency: String = "USD"
  ): Future[Either[String, ChargebeeEstimate]] = {
    logger.info(s"Creating Chargebee estimate for customer: $customerId, ${items.length} items")
    
    val params = scala.collection.mutable.Map[String, String]()
    
    // Add customer information
    params += "customer[first_name]" -> billingAddress.firstName
    params += "customer[last_name]" -> billingAddress.lastName
    params += "customer[email]" -> s"${customerId}@example.com" // Generate email from customer ID
    
    // Add billing address to estimate 
    params += "billing_address[first_name]" -> billingAddress.firstName
    params += "billing_address[last_name]" -> billingAddress.lastName
    params += "billing_address[line1]" -> billingAddress.line1
    params += "billing_address[city]" -> billingAddress.city
    params += "billing_address[state]" -> billingAddress.state
    params += "billing_address[zip]" -> billingAddress.postalCode
    params += "billing_address[country]" -> billingAddress.country
    
    billingAddress.line2.foreach(line2 => params += "billing_address[line2]" -> line2)
    billingAddress.company.foreach(company => params += "billing_address[company]" -> company)
    
    // Add subscription items according to Product Catalog 2.0 format
    items.zipWithIndex.foreach { case (item, index) =>
      params += s"subscription_items[item_price_id][$index]" -> item.itemPriceId
      params += s"subscription_items[quantity][$index]" -> item.quantity.toString
    }
    
    logger.info(s"Estimate parameters: ${params.toMap}")
    
    // Use the correct endpoint for new customer estimates
    val request = basicRequest
      .post(baseUri.addPath("estimates").addPath("create_subscription_for_items"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(params.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)
    
    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          logger.debug(s"Raw estimate response: ${json.spaces2}")
          json.hcursor.downField("estimate").as[ChargebeeEstimate] match {
            case Right(estimate) =>
              val total = estimate.invoice_estimate.map(_.total).getOrElse(0L)
              logger.info(s"✅ Estimate created successfully - Total: $total cents")
              Right(estimate)
            case Left(decodingError) =>
              logger.error(s"❌ Failed to parse estimate: $decodingError")
              logger.debug(s"Raw JSON for debugging: ${json.spaces2}")
              Left(s"Failed to parse estimate: $decodingError")
          }
        case Left(error) =>
          logger.error(s"❌ Estimate API call failed: $error")
          Left(s"Estimate API call failed: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating estimate: ${ex.getMessage}")
        Left(s"Error creating estimate: ${ex.getMessage}")
    }
  }

  def getProductStructure(): Future[ProductStructure] = {
    for {
      items <- listItems()
      itemPrices <- listItemPrices()
    } yield {
      logger.info(s"📊 Product structure: ${items.length} items, ${itemPrices.length} item prices")
      ProductStructure(items, itemPrices)
    }
  }

  /**
   * Create a portal session for customer subscription management
   */
  def createPortalSession(customerId: String, redirectUrl: String = "https://your-website.com/account"): Future[Either[String, ChargebeePortalSession]] = {
    logger.info(s"Creating portal session for customer: $customerId")
    
    val requestBody = Map(
      "redirect_url" -> redirectUrl,
      "customer[id]" -> customerId
    )

    val request = basicRequest
      .post(baseUri.addPath("portal_sessions"))
      .header("Authorization", authHeader)
      .header("Content-Type", "application/x-www-form-urlencoded")
      .body(requestBody.map { case (k, v) => s"$k=$v" }.mkString("&"))
      .response(asJson[Json])
      .readTimeout(config.timeout)

    backend.send(request).map { response =>
      response.body match {
        case Right(json) =>
          logger.debug(s"Portal session response: ${json.spaces2}")
          
          // Parse the portal session from the response
          val cursor = json.hcursor
          cursor.downField("portal_session").as[ChargebeePortalSession] match {
            case Right(portalSession) =>
              logger.info(s"✅ Portal session created successfully: ${portalSession.id}")
              Right(portalSession)
            case Left(decodingError) =>
              logger.error(s"❌ Failed to decode portal session response: $decodingError")
              logger.debug(s"Response body: ${json.spaces2}")
              Left(s"Failed to decode portal session: ${decodingError.getMessage}")
          }
        case Left(error) =>
          logger.error(s"❌ Portal session creation failed: $error")
          Left(s"Portal session creation failed: $error")
      }
    }.recover {
      case ex =>
        logger.error(s"❌ Error creating portal session: ${ex.getMessage}")
        Left(s"Error creating portal session: ${ex.getMessage}")
    }
  }
}
