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
  private val baseUri = uri"https://$siteName.chargebee.com/api/v2"
  private val authHeader = "Basic " + Base64.getEncoder.encodeToString(s"$apiKey:".getBytes)

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

  def getProductStructure(): Future[ProductStructure] = {
    for {
      items <- listItems()
      itemPrices <- listItemPrices()
    } yield {
      logger.info(s"📊 Product structure: ${items.length} items, ${itemPrices.length} item prices")
      ProductStructure(items, itemPrices)
    }
  }
}
