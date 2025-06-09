package com.nitro.pricing.services

import com.nitro.pricing.models.{ProductStructure, ChargebeeItem, ChargebeeItemPrice, RampPrice, PricingPlan, PricingProductFamily, PricingApiResponse}
import com.typesafe.scalalogging.LazyLogging
import io.circe.parser.decode
import io.circe.generic.auto._

import scala.concurrent.{ExecutionContext, Future}
import scala.io.Source
import scala.util.{Try, Success, Failure}

case class StaticPricingData(
  productFamilies: List[PricingProductFamily]
)

class PricingService(
  chargebeeClient: ChargebeeClient
)(implicit ec: ExecutionContext) extends LazyLogging {

  private val staticPricingFile = "pricing-data.json"
  
  // Cache for static pricing data (3-year pricing)
  private var cachedStaticData: Option[StaticPricingData] = None
  
  // Cache for Chargebee data with TTL
  private var cachedChargebeeData: Option[(ProductStructure, Long)] = None
  private val chargebeeCacheTtlMs = 60 * 60 * 1000 // 1 hour TTL
  
  def getPricing(currency: String = "USD"): Future[PricingApiResponse] = {
    logger.info(s"Fetching pricing data for currency: $currency")
    
    for {
      staticData <- loadStaticPricingData()
      chargebeeData <- getCachedChargebeeData()
    } yield {
      val mergedProductFamilies = mergeChargebeeWithStaticData(staticData, chargebeeData, currency)
      
      PricingApiResponse(
        productFamilies = mergedProductFamilies,
        supportedCurrencies = List("USD", "EUR", "GBP", "CAD", "AUD"),
        lastUpdated = java.time.Instant.now().toString
      )
    }
  }
  
  private def loadStaticPricingData(): Future[StaticPricingData] = {
    cachedStaticData match {
      case Some(data) => Future.successful(data)
      case None =>
        Future {
          val source = Source.fromResource(staticPricingFile)
          val jsonString = try {
            source.mkString
          } finally {
            source.close()
          }
          
          decode[StaticPricingData](jsonString) match {
            case Right(data) =>
              logger.info("Successfully loaded static pricing data")
              cachedStaticData = Some(data)
              data
            case Left(error) =>
              logger.error(s"Failed to parse static pricing data: $error")
              throw new RuntimeException(s"Failed to load static pricing data: $error")
          }
        }
    }
  }
  
  private def getCachedChargebeeData(): Future[ProductStructure] = {
    val currentTime = System.currentTimeMillis()
    
    cachedChargebeeData match {
      case Some((data, cachedTime)) if (currentTime - cachedTime) < chargebeeCacheTtlMs =>
        logger.debug("Using cached Chargebee data")
        Future.successful(data)
      case _ =>
        logger.info("Fetching fresh Chargebee data")
        chargebeeClient.getProductStructure().map { data =>
          cachedChargebeeData = Some((data, currentTime))
          data
        }.recover {
          case ex =>
            logger.warn(s"Failed to fetch Chargebee data, using cached if available: ${ex.getMessage}")
            cachedChargebeeData.map(_._1).getOrElse(throw ex)
        }
    }
  }
  
  private def mergeChargebeeWithStaticData(
    staticData: StaticPricingData,
    chargebeeData: ProductStructure,
    currency: String
  ): List[PricingProductFamily] = {
    
    logger.info(s"Merging pricing data: ${staticData.productFamilies.length} static families, ${chargebeeData.items.length} Chargebee items")
    
    // Map to store Chargebee pricing by item name
    val chargebeePricingMap = chargebeeData.itemPrices
      .filter(_.currency_code.toUpperCase == currency.toUpperCase)
      .groupBy(_.item_id)
    
    staticData.productFamilies.map { family =>
      val updatedPlans = family.plans.map { plan =>
        // Try to find corresponding Chargebee pricing for 1-year terms
        val chargebeeOneYearPricing = findChargebeePricingForPlan(plan.name, chargebeePricingMap)
        
        plan.copy(
          oneYearPricing = chargebeeOneYearPricing.getOrElse(plan.oneYearPricing)
          // Keep threeYearPricing from static data unchanged
        )
      }
      
      family.copy(plans = updatedPlans)
    }
  }
  
  private def findChargebeePricingForPlan(
    planName: String,
    chargebeePricingMap: Map[String, List[ChargebeeItemPrice]]
  ): Option[List[RampPrice]] = {
    
    // Map plan names to Chargebee item IDs
    val itemId = planName match {
      case "Nitro PDF Standard" => "Nitro_PDF_STD"
      case "Nitro PDF Plus" => "Nitro_PDF_PLUS"
      case "Nitro Sign Standard" => "Nitro_SIGN_STD"
      case "Nitro Sign Plus" => "Nitro_SIGN_PLUS"
      case "Nitro Sign Enterprise" => "Nitro_SIGN_ENT"
      case _ => 
        logger.warn(s"No Chargebee mapping found for plan: $planName")
        return None
    }
    
    logger.debug(s"Looking for Chargebee pricing for plan '$planName' -> item '$itemId'")
    
    chargebeePricingMap.get(itemId) match {
      case Some(itemPrices) =>
        logger.debug(s"Found ${itemPrices.length} item prices for $itemId")
        // Find yearly pricing (period = 1, period_unit = "year")
        itemPrices.find(ip => ip.period == 1 && ip.period_unit == "year") match {
          case Some(itemPrice) =>
            logger.debug(s"Found yearly pricing for $itemId: ${itemPrice.id}")
            itemPrice.tiers match {
              case Some(tierList) =>
                logger.debug(s"Found ${tierList.length} tiers for $itemId")
                val rampPrices = tierList.map { tier =>
                  RampPrice(
                    minSeats = tier.starting_unit,
                    price = BigDecimal(tier.price_in_decimal)
                  )
                }.sortBy(_.minSeats) // Ensure proper ordering
                logger.debug(s"Converted tiers for $itemId: ${rampPrices.take(2)}")
                Some(rampPrices)
              case None =>
                logger.warn(s"No tiers found for $itemId pricing")
                None
            }
          case None =>
            logger.warn(s"No yearly pricing found for $itemId (available periods: ${itemPrices.map(ip => s"${ip.period} ${ip.period_unit}").mkString(", ")})")
            None
        }
      case None =>
        logger.warn(s"No item prices found for $itemId. Available items: ${chargebeePricingMap.keys.mkString(", ")}")
        None
    }
  }
}
