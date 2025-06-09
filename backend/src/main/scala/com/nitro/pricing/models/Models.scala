package com.nitro.pricing.models

import io.circe._
import io.circe.generic.semiauto._

// Core domain models
case class Money(amount: BigDecimal, currency: String)

case class PricingTier(
  minQuantity: Int,
  maxQuantity: Option[Int],
  pricePerUnit: Money
)

case class Addon(
  id: String,
  name: String,
  description: String,
  pricingTiers: List[PricingTier],
  billingTerm: BillingTerm
)

case class Plan(
  id: String,
  name: String,
  description: String,
  price: Money,
  billingTerm: BillingTerm
)

sealed trait BillingTerm {
  def value: String
}

object BillingTerm {
  case object OneYear extends BillingTerm { val value = "1-year" }
  case object ThreeYear extends BillingTerm { val value = "3-year" }
  
  def fromString(value: String): BillingTerm = value.toLowerCase match {
    case "1-year" | "1year" | "annual" => OneYear
    case "3-year" | "3year" | "triennial" => ThreeYear
    case _ => throw new IllegalArgumentException(s"Unknown billing term: $value")
  }
}

// Request/Response models
case class EstimateRequest(
  items: List[EstimateItem],
  currency: String,
  billingTerm: String
)

case class EstimateItem(
  addonId: String,
  quantity: Int
)

case class EstimateResponse(
  items: List[EstimateItemResponse],
  subtotal: Money,
  total: Money,
  billingTerm: String
)

case class EstimateItemResponse(
  addonId: String,
  addonName: String,
  quantity: Int,
  unitPrice: Money,
  totalPrice: Money,
  appliedTier: PricingTier
)

case class PricingResponse(
  plans: List[Plan],
  addons: List[Addon],
  supportedCurrencies: List[String],
  lastUpdated: String
)

// Tax calculation models
case class TaxRequest(
  customerAddress: Address,
  lineItems: List[TaxLineItem],
  currency: String
)

case class Address(
  line1: String,
  line2: Option[String] = None,
  city: String,
  state: String,
  postalCode: String,
  country: String
)

case class TaxLineItem(
  description: String,
  amount: Money,
  taxable: Boolean = true
)

case class TaxResponse(
  totalTax: Money,
  taxBreakdown: List[TaxBreakdownItem],
  lineItems: List[TaxLineItemResponse]
)

case class TaxBreakdownItem(
  taxType: String,
  rate: BigDecimal,
  amount: Money,
  jurisdiction: String
)

case class TaxLineItemResponse(
  description: String,
  subtotal: Money,
  taxAmount: Money,
  total: Money
)

// Pricing API models
case class RampPrice(minSeats: Int, price: BigDecimal)

case class PricingPlan(
  name: String,
  description: String,
  features: List[String],
  oneYearPricing: List[RampPrice],
  threeYearPricing: List[RampPrice],
  packagePrice: Option[BigDecimal] = None,
  apiPrice: Option[BigDecimal] = None,
  freePackagesPerSeat: Option[Int] = None
)

case class PricingProductFamily(
  name: String,
  description: String,
  plans: List[PricingPlan]
)

case class PricingApiResponse(
  productFamilies: List[PricingProductFamily],
  supportedCurrencies: List[String],
  lastUpdated: String
)

// Chargebee Product Catalog 2.0 models
case class ChargebeeItem(
  id: String,
  name: String,
  external_name: String,
  status: String,
  item_family_id: String,
  `type`: String,
  is_shippable: Boolean,
  is_giftable: Boolean,
  enabled_for_checkout: Boolean,
  enabled_in_portal: Boolean,
  unit: Option[String] = None,
  metered: Boolean,
  channel: String,
  bundle_items: List[String] = List.empty,
  deleted: Boolean,
  `object`: String
)

case class ChargebeeItemPriceTier(
  starting_unit: Int,
  ending_unit: Option[Int],
  price: Int,
  starting_unit_in_decimal: String,
  ending_unit_in_decimal: Option[String],
  pricing_type: String,
  price_in_decimal: String
)

case class ChargebeeItemPrice(
  id: String,
  name: String,
  item_family_id: String,
  item_id: String,
  status: String,
  external_name: String,
  pricing_model: String,
  period: Int,
  currency_code: String,
  period_unit: String,
  free_quantity: Int,
  free_quantity_in_decimal: String,
  channel: String,
  resource_version: Long,
  updated_at: Long,
  created_at: Long,
  tiers: Option[List[ChargebeeItemPriceTier]] = None,
  is_taxable: Boolean,
  item_type: String,
  show_description_in_invoices: Boolean,
  show_description_in_quotes: Boolean,
  deleted: Boolean,
  `object`: String
)

case class ProductStructure(
  items: List[ChargebeeItem],
  itemPrices: List[ChargebeeItemPrice]
)

// Legacy PC 1.0 models (kept for backward compatibility)
case class ChargebeeDiscoveryResponse(
  plans: List[ChargebeePlan],
  addons: List[ChargebeeAddon],
  discoveredAt: String,
  site: String
)

case class ChargebeePlan(
  id: String,
  name: String,
  price: Long, // in cents
  currency: String,
  period: Int,
  periodUnit: String,
  status: String
)

case class ChargebeeAddon(
  id: String,
  name: String,
  addonType: String,
  chargeType: String,
  price: Long, // in cents
  currency: String,
  pricingModel: String,
  tiers: Option[List[ChargebeeTier]],
  status: String
)

case class ChargebeeTier(
  startingUnit: Int,
  endingUnit: Option[Int],
  price: Long // in cents
)

// Health check models
case class ServiceStatus(
  chargebee: String,
  taxService: String,
  stripe: String
)

case class HealthResponse(
  status: String,
  services: ServiceStatus,
  timestamp: String,
  error: Option[String] = None
)

// JSON codecs
object JsonCodecs {
  
  // Basic types
  implicit val moneyEncoder: Encoder[Money] = deriveEncoder[Money]
  implicit val moneyDecoder: Decoder[Money] = deriveDecoder[Money]
  
  // BillingTerm custom codec
  implicit val billingTermEncoder: Encoder[BillingTerm] = Encoder.encodeString.contramap(_.value)
  implicit val billingTermDecoder: Decoder[BillingTerm] = Decoder.decodeString.emap { str =>
    try {
      Right(BillingTerm.fromString(str))
    } catch {
      case _: IllegalArgumentException => Left(s"Invalid billing term: $str")
    }
  }
  
  // Core domain types
  implicit val pricingTierEncoder: Encoder[PricingTier] = deriveEncoder[PricingTier]
  implicit val pricingTierDecoder: Decoder[PricingTier] = deriveDecoder[PricingTier]
  
  implicit val addonEncoder: Encoder[Addon] = deriveEncoder[Addon]
  implicit val addonDecoder: Decoder[Addon] = deriveDecoder[Addon]
  
  implicit val planEncoder: Encoder[Plan] = deriveEncoder[Plan]
  implicit val planDecoder: Decoder[Plan] = deriveDecoder[Plan]
  
  // Request/Response types
  implicit val estimateItemEncoder: Encoder[EstimateItem] = deriveEncoder[EstimateItem]
  implicit val estimateItemDecoder: Decoder[EstimateItem] = deriveDecoder[EstimateItem]
  
  implicit val estimateRequestEncoder: Encoder[EstimateRequest] = deriveEncoder[EstimateRequest]
  implicit val estimateRequestDecoder: Decoder[EstimateRequest] = deriveDecoder[EstimateRequest]
  
  implicit val estimateItemResponseEncoder: Encoder[EstimateItemResponse] = deriveEncoder[EstimateItemResponse]
  implicit val estimateItemResponseDecoder: Decoder[EstimateItemResponse] = deriveDecoder[EstimateItemResponse]
  
  implicit val estimateResponseEncoder: Encoder[EstimateResponse] = deriveEncoder[EstimateResponse]
  implicit val estimateResponseDecoder: Decoder[EstimateResponse] = deriveDecoder[EstimateResponse]
  
  implicit val pricingResponseEncoder: Encoder[PricingResponse] = deriveEncoder[PricingResponse]
  implicit val pricingResponseDecoder: Decoder[PricingResponse] = deriveDecoder[PricingResponse]
  
  // Tax calculation types
  implicit val addressEncoder: Encoder[Address] = deriveEncoder[Address]
  implicit val addressDecoder: Decoder[Address] = deriveDecoder[Address]
  
  implicit val taxLineItemEncoder: Encoder[TaxLineItem] = deriveEncoder[TaxLineItem]
  implicit val taxLineItemDecoder: Decoder[TaxLineItem] = deriveDecoder[TaxLineItem]
  
  implicit val taxRequestEncoder: Encoder[TaxRequest] = deriveEncoder[TaxRequest]
  implicit val taxRequestDecoder: Decoder[TaxRequest] = deriveDecoder[TaxRequest]
  
  implicit val taxBreakdownItemEncoder: Encoder[TaxBreakdownItem] = deriveEncoder[TaxBreakdownItem]
  implicit val taxBreakdownItemDecoder: Decoder[TaxBreakdownItem] = deriveDecoder[TaxBreakdownItem]
  
  implicit val taxLineItemResponseEncoder: Encoder[TaxLineItemResponse] = deriveEncoder[TaxLineItemResponse]
  implicit val taxLineItemResponseDecoder: Decoder[TaxLineItemResponse] = deriveDecoder[TaxLineItemResponse]
  
  implicit val taxResponseEncoder: Encoder[TaxResponse] = deriveEncoder[TaxResponse]
  implicit val taxResponseDecoder: Decoder[TaxResponse] = deriveDecoder[TaxResponse]
  
  // Pricing API types
  implicit val rampPriceEncoder: Encoder[RampPrice] = deriveEncoder[RampPrice]
  implicit val rampPriceDecoder: Decoder[RampPrice] = deriveDecoder[RampPrice]
  
  implicit val pricingPlanEncoder: Encoder[PricingPlan] = deriveEncoder[PricingPlan]
  implicit val pricingPlanDecoder: Decoder[PricingPlan] = deriveDecoder[PricingPlan]
  
  implicit val pricingProductFamilyEncoder: Encoder[PricingProductFamily] = deriveEncoder[PricingProductFamily]
  implicit val pricingProductFamilyDecoder: Decoder[PricingProductFamily] = deriveDecoder[PricingProductFamily]
  
  implicit val pricingApiResponseEncoder: Encoder[PricingApiResponse] = deriveEncoder[PricingApiResponse]
  implicit val pricingApiResponseDecoder: Decoder[PricingApiResponse] = deriveDecoder[PricingApiResponse]
  
  // Chargebee Product Catalog 2.0 types
  implicit val chargebeeItemPriceTierEncoder: Encoder[ChargebeeItemPriceTier] = deriveEncoder[ChargebeeItemPriceTier]
  implicit val chargebeeItemPriceTierDecoder: Decoder[ChargebeeItemPriceTier] = deriveDecoder[ChargebeeItemPriceTier]
  
  implicit val chargebeeItemEncoder: Encoder[ChargebeeItem] = deriveEncoder[ChargebeeItem]
  implicit val chargebeeItemDecoder: Decoder[ChargebeeItem] = deriveDecoder[ChargebeeItem]
  
  implicit val chargebeeItemPriceEncoder: Encoder[ChargebeeItemPrice] = deriveEncoder[ChargebeeItemPrice]
  implicit val chargebeeItemPriceDecoder: Decoder[ChargebeeItemPrice] = deriveDecoder[ChargebeeItemPrice]
  
  implicit val productStructureEncoder: Encoder[ProductStructure] = deriveEncoder[ProductStructure]
  implicit val productStructureDecoder: Decoder[ProductStructure] = deriveDecoder[ProductStructure]

  // Legacy Chargebee PC 1.0 types (for backward compatibility)
  implicit val chargebeeTierEncoder: Encoder[ChargebeeTier] = deriveEncoder[ChargebeeTier]
  implicit val chargebeeTierDecoder: Decoder[ChargebeeTier] = deriveDecoder[ChargebeeTier]
  
  implicit val chargebeeAddonEncoder: Encoder[ChargebeeAddon] = deriveEncoder[ChargebeeAddon]
  implicit val chargebeeAddonDecoder: Decoder[ChargebeeAddon] = deriveDecoder[ChargebeeAddon]
  
  implicit val chargebeePlanEncoder: Encoder[ChargebeePlan] = deriveEncoder[ChargebeePlan]
  implicit val chargebeePlanDecoder: Decoder[ChargebeePlan] = deriveDecoder[ChargebeePlan]
  
  implicit val chargebeeDiscoveryResponseEncoder: Encoder[ChargebeeDiscoveryResponse] = deriveEncoder[ChargebeeDiscoveryResponse]
  implicit val chargebeeDiscoveryResponseDecoder: Decoder[ChargebeeDiscoveryResponse] = deriveDecoder[ChargebeeDiscoveryResponse]
  
  // Health check types
  implicit val serviceStatusEncoder: Encoder[ServiceStatus] = deriveEncoder[ServiceStatus]
  implicit val serviceStatusDecoder: Decoder[ServiceStatus] = deriveDecoder[ServiceStatus]
  
  implicit val healthResponseEncoder: Encoder[HealthResponse] = deriveEncoder[HealthResponse]
  implicit val healthResponseDecoder: Decoder[HealthResponse] = deriveDecoder[HealthResponse]
}
