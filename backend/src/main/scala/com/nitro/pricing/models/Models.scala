package com.nitro.pricing.models

import io.circe._
import io.circe.generic.semiauto._

// Core domain models
case class Money(amount: BigDecimal, currency: String)

// Pricing estimate API models (different from legacy addon-based estimates)
case class PricingEstimateItemRequest(
  productFamily: String,
  planName: String,
  seats: Int,
  packages: Option[Int] = None,
  apiCalls: Option[Int] = None
)

case class PricingEstimateRequest(
  items: List[PricingEstimateItemRequest],
  currency: String = "USD",
  billingTerm: String = "1year" // "1year" or "3year"
)

case class PricingEstimateItemResponse(
  productFamily: String,
  planName: String,
  seats: Int,
  basePrice: BigDecimal,
  packagesPrice: BigDecimal,
  apiCallsPrice: BigDecimal,
  totalPrice: BigDecimal,
  appliedTier: RampPrice,
  includedPackages: Option[Int] = None,
  extraPackages: Option[Int] = None
)

case class PricingEstimateResponse(
  items: List[PricingEstimateItemResponse],
  subtotal: BigDecimal,
  total: BigDecimal,
  currency: String,
  billingTerm: String
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

// Tax calculation models
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

case class TaxRequest(
  customerAddress: Address,
  lineItems: List[TaxLineItem],
  currency: String
)

case class TaxBreakdownItem(
  name: String,
  rate: BigDecimal,
  amount: Money,
  description: String
)

case class TaxLineItemResponse(
  description: String,
  subtotal: Money,
  taxAmount: Money,
  total: Money
)

case class TaxResponse(
  totalTax: Money,
  taxBreakdown: List[TaxBreakdownItem],
  lineItems: List[TaxLineItemResponse]
)

// Frontend tax request models (to support the different format from frontend)
case class FrontendAddress(
  line1: String,
  line2: Option[String] = None,
  city: String,
  state: String,
  zip: String,  // Frontend uses "zip" instead of "postalCode"
  country: String
)

case class FrontendTaxItem(
  productFamily: String,
  planName: String,
  seats: Int,
  packages: Option[Int] = None,
  apiCalls: Option[Int] = None
)

case class FrontendTaxRequest(
  items: List[FrontendTaxItem],
  customerAddress: FrontendAddress,
  currency: String
)

// Checkout models
case class Customer(
  id: Option[String] = None,
  firstName: String,
  lastName: String,
  email: String,
  company: Option[String] = None,
  phone: Option[String] = None
)

case class BillingAddress(
  firstName: String,
  lastName: String,
  line1: String,
  line2: Option[String] = None,
  city: String,
  state: String,
  postalCode: String,
  country: String,
  company: Option[String] = None
)

case class CheckoutItem(
  itemPriceId: String,
  quantity: Int
)

case class CheckoutRequest(
  customer: Customer,
  billingAddress: BillingAddress,
  items: List[CheckoutItem],
  currency: String = "USD",
  billingTerm: String = "1year",
  paymentMethodId: Option[String] = None,
  stripeToken: Option[String] = None
)

case class CheckoutResponse(
  success: Boolean,
  customerId: String,
  subscriptionId: Option[String] = None,
  hostedPageUrl: Option[String] = None,
  message: String,
  salesContactRequired: Boolean = false,
  paymentIntentId: Option[String] = None,
  paymentStatus: Option[String] = None
)

// Chargebee API response models
case class ChargebeeCustomer(
  id: String,
  firstName: Option[String],
  lastName: Option[String],
  email: String,
  company: Option[String],
  phone: Option[String],
  billingAddress: Option[ChargebeeBillingAddress] = None,
  `object`: String = "customer"
)

case class ChargebeeBillingAddress(
  firstName: Option[String],
  lastName: Option[String],
  line1: Option[String],
  line2: Option[String],
  city: Option[String],
  state: Option[String],
  zip: Option[String],
  country: Option[String],
  company: Option[String]
)

case class ChargebeeSubscription(
  id: String,
  customer_id: String,
  status: String,
  current_term_start: Long,
  current_term_end: Long,
  currency_code: String,
  billing_period: Option[Int] = None,
  billing_period_unit: Option[String] = None,
  next_billing_at: Option[Long] = None,
  created_at: Option[Long] = None,
  updated_at: Option[Long] = None,
  `object`: String = "subscription"
)

case class ChargebeeCustomerResponse(
  customer: ChargebeeCustomer
)

case class ChargebeeSubscriptionResponse(
  subscription: ChargebeeSubscription,
  customer: ChargebeeCustomer
)

case class ChargebeeEstimate(
  created_at: Long,
  invoice_estimate: Option[ChargebeeInvoiceEstimate] = None,
  subscription_estimate: Option[ChargebeeSubscriptionEstimate] = None
)

case class ChargebeeInvoiceEstimate(
  amount_due: Long,
  amount_paid: Long,
  credits_applied: Long,
  currency_code: String,
  customer_id: String,
  date: Long,
  sub_total: Long,
  total: Long,
  taxes: Option[List[ChargebeeTax]] = None,
  line_items: Option[List[ChargebeeLineItem]] = None,
  line_item_taxes: Option[List[ChargebeeLineItemTax]] = None
)

case class ChargebeeSubscriptionEstimate(
  currency_code: String,
  next_billing_at: Option[Long] = None,
  status: String
)

case class ChargebeeTax(
  name: String,
  amount: Long,
  description: Option[String] = None
)

case class ChargebeeLineItem(
  id: String,
  description: String,
  amount: Long,
  quantity: Int,
  unit_amount: Long,
  entity_id: String,
  entity_type: String,
  customer_id: String,
  date_from: Long,
  date_to: Long,
  discount_amount: Long,
  tax_amount: Long,
  is_taxed: Boolean
)

case class ChargebeeLineItemTax(
  line_item_id: String,
  tax_name: String,
  tax_rate: Double,
  tax_amount: Long,
  taxable_amount: Long
)

// Avalara AvaTax API Models
case class AvalaraAddress(
  line1: String,
  city: String,
  region: String,
  postalCode: String,
  country: String
)

case class AvalaraLineItem(
  number: String,
  description: String,
  amount: BigDecimal,
  taxIncluded: Boolean = false,
  taxCode: String = "SW054000", // Software as a Service tax code
  itemCode: String,
  quantity: Int = 1
)

case class AvalaraCreateTransactionRequest(
  `type`: String = "SalesInvoice",
  code: String,
  date: String,
  currencyCode: String,
  customerCode: String = "NITRO-CUSTOMER",
  addresses: Map[String, AvalaraAddress],
  lines: List[AvalaraLineItem]
)

case class AvalaraTaxDetail(
  taxName: String,
  rate: BigDecimal,
  tax: BigDecimal,
  taxAuthorityTypeId: Option[Int] = None,
  jurisName: String
)

case class AvalaraLineResponse(
  lineNumber: String,
  description: String,
  lineAmount: BigDecimal,
  tax: BigDecimal,
  details: List[AvalaraTaxDetail] = List.empty
)

case class AvalaraSummaryItem(
  taxName: String,
  rate: BigDecimal,
  tax: BigDecimal,
  jurisName: String
)

case class AvalaraTransactionResponse(
  code: String,
  totalAmount: BigDecimal,
  totalTax: BigDecimal,
  lines: List[AvalaraLineResponse],
  summary: List[AvalaraSummaryItem] = List.empty
)

// JSON codecs
object JsonCodecs {
  
  // Basic types
  implicit val moneyEncoder: Encoder[Money] = deriveEncoder[Money]
  implicit val moneyDecoder: Decoder[Money] = deriveDecoder[Money]
  
  // Chargebee models
  implicit val chargebeeItemEncoder: Encoder[ChargebeeItem] = deriveEncoder[ChargebeeItem]
  implicit val chargebeeItemDecoder: Decoder[ChargebeeItem] = deriveDecoder[ChargebeeItem]
  
  implicit val chargebeeItemPriceTierEncoder: Encoder[ChargebeeItemPriceTier] = deriveEncoder[ChargebeeItemPriceTier]
  implicit val chargebeeItemPriceTierDecoder: Decoder[ChargebeeItemPriceTier] = deriveDecoder[ChargebeeItemPriceTier]
  
  implicit val chargebeeItemPriceEncoder: Encoder[ChargebeeItemPrice] = deriveEncoder[ChargebeeItemPrice]
  implicit val chargebeeItemPriceDecoder: Decoder[ChargebeeItemPrice] = deriveDecoder[ChargebeeItemPrice]
  
  implicit val productStructureEncoder: Encoder[ProductStructure] = deriveEncoder[ProductStructure]
  implicit val productStructureDecoder: Decoder[ProductStructure] = deriveDecoder[ProductStructure]
  
  // Health check types
  implicit val serviceStatusEncoder: Encoder[ServiceStatus] = deriveEncoder[ServiceStatus]
  implicit val serviceStatusDecoder: Decoder[ServiceStatus] = deriveDecoder[ServiceStatus]
  
  implicit val healthResponseEncoder: Encoder[HealthResponse] = deriveEncoder[HealthResponse]
  implicit val healthResponseDecoder: Decoder[HealthResponse] = deriveDecoder[HealthResponse]
  
  implicit val pricingApiResponseEncoder: Encoder[PricingApiResponse] = deriveEncoder[PricingApiResponse]
  implicit val pricingApiResponseDecoder: Decoder[PricingApiResponse] = deriveDecoder[PricingApiResponse]
  
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
  
  // Frontend tax request types
  implicit val frontendAddressEncoder: Encoder[FrontendAddress] = deriveEncoder[FrontendAddress]
  implicit val frontendAddressDecoder: Decoder[FrontendAddress] = deriveDecoder[FrontendAddress]
  
  implicit val frontendTaxItemEncoder: Encoder[FrontendTaxItem] = deriveEncoder[FrontendTaxItem]
  implicit val frontendTaxItemDecoder: Decoder[FrontendTaxItem] = deriveDecoder[FrontendTaxItem]
  
  implicit val frontendTaxRequestEncoder: Encoder[FrontendTaxRequest] = deriveEncoder[FrontendTaxRequest]
  implicit val frontendTaxRequestDecoder: Decoder[FrontendTaxRequest] = deriveDecoder[FrontendTaxRequest]
  
  // Pricing API types
  implicit val rampPriceEncoder: Encoder[RampPrice] = deriveEncoder[RampPrice]
  implicit val rampPriceDecoder: Decoder[RampPrice] = deriveDecoder[RampPrice]
  
  implicit val pricingPlanEncoder: Encoder[PricingPlan] = deriveEncoder[PricingPlan]
  implicit val pricingPlanDecoder: Decoder[PricingPlan] = deriveDecoder[PricingPlan]
  
  implicit val pricingProductFamilyEncoder: Encoder[PricingProductFamily] = deriveEncoder[PricingProductFamily]
  implicit val pricingProductFamilyDecoder: Decoder[PricingProductFamily] = deriveDecoder[PricingProductFamily]
  
  implicit val pricingEstimateItemRequestEncoder: Encoder[PricingEstimateItemRequest] = deriveEncoder[PricingEstimateItemRequest]
  implicit val pricingEstimateItemRequestDecoder: Decoder[PricingEstimateItemRequest] = deriveDecoder[PricingEstimateItemRequest]
  
  implicit val pricingEstimateRequestEncoder: Encoder[PricingEstimateRequest] = deriveEncoder[PricingEstimateRequest]
  implicit val pricingEstimateRequestDecoder: Decoder[PricingEstimateRequest] = deriveDecoder[PricingEstimateRequest]
  
  implicit val pricingEstimateItemResponseEncoder: Encoder[PricingEstimateItemResponse] = deriveEncoder[PricingEstimateItemResponse]
  implicit val pricingEstimateItemResponseDecoder: Decoder[PricingEstimateItemResponse] = deriveDecoder[PricingEstimateItemResponse]
  
  implicit val pricingEstimateResponseEncoder: Encoder[PricingEstimateResponse] = deriveEncoder[PricingEstimateResponse]
  implicit val pricingEstimateResponseDecoder: Decoder[PricingEstimateResponse] = deriveDecoder[PricingEstimateResponse]
  
  // Checkout types
  implicit val customerEncoder: Encoder[Customer] = deriveEncoder[Customer]
  implicit val customerDecoder: Decoder[Customer] = deriveDecoder[Customer]
  
  implicit val billingAddressEncoder: Encoder[BillingAddress] = deriveEncoder[BillingAddress]
  implicit val billingAddressDecoder: Decoder[BillingAddress] = deriveDecoder[BillingAddress]
  
  implicit val checkoutItemEncoder: Encoder[CheckoutItem] = deriveEncoder[CheckoutItem]
  implicit val checkoutItemDecoder: Decoder[CheckoutItem] = deriveDecoder[CheckoutItem]
  
  implicit val checkoutRequestEncoder: Encoder[CheckoutRequest] = deriveEncoder[CheckoutRequest]
  implicit val checkoutRequestDecoder: Decoder[CheckoutRequest] = deriveDecoder[CheckoutRequest]
  
  implicit val checkoutResponseEncoder: Encoder[CheckoutResponse] = deriveEncoder[CheckoutResponse]
  implicit val checkoutResponseDecoder: Decoder[CheckoutResponse] = deriveDecoder[CheckoutResponse]
  
  // Chargebee API response types
  implicit val chargebeeBillingAddressEncoder: Encoder[ChargebeeBillingAddress] = deriveEncoder[ChargebeeBillingAddress]
  implicit val chargebeeBillingAddressDecoder: Decoder[ChargebeeBillingAddress] = deriveDecoder[ChargebeeBillingAddress]
  
  implicit val chargebeeCustomerEncoder: Encoder[ChargebeeCustomer] = deriveEncoder[ChargebeeCustomer]
  implicit val chargebeeCustomerDecoder: Decoder[ChargebeeCustomer] = deriveDecoder[ChargebeeCustomer]
  
  implicit val chargebeeSubscriptionEncoder: Encoder[ChargebeeSubscription] = deriveEncoder[ChargebeeSubscription]
  implicit val chargebeeSubscriptionDecoder: Decoder[ChargebeeSubscription] = deriveDecoder[ChargebeeSubscription]
  
  implicit val chargebeeCustomerResponseEncoder: Encoder[ChargebeeCustomerResponse] = deriveEncoder[ChargebeeCustomerResponse]
  implicit val chargebeeCustomerResponseDecoder: Decoder[ChargebeeCustomerResponse] = deriveDecoder[ChargebeeCustomerResponse]
  
  implicit val chargebeeSubscriptionResponseEncoder: Encoder[ChargebeeSubscriptionResponse] = deriveEncoder[ChargebeeSubscriptionResponse]
  implicit val chargebeeSubscriptionResponseDecoder: Decoder[ChargebeeSubscriptionResponse] = deriveDecoder[ChargebeeSubscriptionResponse]
  
  implicit val chargebeeTaxEncoder: Encoder[ChargebeeTax] = deriveEncoder[ChargebeeTax]
  implicit val chargebeeTaxDecoder: Decoder[ChargebeeTax] = deriveDecoder[ChargebeeTax]
  
  implicit val chargebeeLineItemEncoder: Encoder[ChargebeeLineItem] = deriveEncoder[ChargebeeLineItem]
  implicit val chargebeeLineItemDecoder: Decoder[ChargebeeLineItem] = deriveDecoder[ChargebeeLineItem]
  
  implicit val chargebeeLineItemTaxEncoder: Encoder[ChargebeeLineItemTax] = deriveEncoder[ChargebeeLineItemTax]
  implicit val chargebeeLineItemTaxDecoder: Decoder[ChargebeeLineItemTax] = deriveDecoder[ChargebeeLineItemTax]
  
  implicit val chargebeeInvoiceEstimateEncoder: Encoder[ChargebeeInvoiceEstimate] = deriveEncoder[ChargebeeInvoiceEstimate]
  implicit val chargebeeInvoiceEstimateDecoder: Decoder[ChargebeeInvoiceEstimate] = deriveDecoder[ChargebeeInvoiceEstimate]
  
  implicit val chargebeeSubscriptionEstimateEncoder: Encoder[ChargebeeSubscriptionEstimate] = deriveEncoder[ChargebeeSubscriptionEstimate]
  implicit val chargebeeSubscriptionEstimateDecoder: Decoder[ChargebeeSubscriptionEstimate] = deriveDecoder[ChargebeeSubscriptionEstimate]
  
  implicit val chargebeeEstimateEncoder: Encoder[ChargebeeEstimate] = deriveEncoder[ChargebeeEstimate]
  implicit val chargebeeEstimateDecoder: Decoder[ChargebeeEstimate] = deriveDecoder[ChargebeeEstimate]
  
  // Avalara models
  implicit val avalaraAddressEncoder: Encoder[AvalaraAddress] = deriveEncoder[AvalaraAddress]
  implicit val avalaraAddressDecoder: Decoder[AvalaraAddress] = deriveDecoder[AvalaraAddress]
  
  implicit val avalaraLineItemEncoder: Encoder[AvalaraLineItem] = deriveEncoder[AvalaraLineItem]
  implicit val avalaraLineItemDecoder: Decoder[AvalaraLineItem] = deriveDecoder[AvalaraLineItem]
  
  implicit val avalaraCreateTransactionRequestEncoder: Encoder[AvalaraCreateTransactionRequest] = deriveEncoder[AvalaraCreateTransactionRequest]
  implicit val avalaraCreateTransactionRequestDecoder: Decoder[AvalaraCreateTransactionRequest] = deriveDecoder[AvalaraCreateTransactionRequest]
  
  implicit val avalaraTaxDetailEncoder: Encoder[AvalaraTaxDetail] = deriveEncoder[AvalaraTaxDetail]
  implicit val avalaraTaxDetailDecoder: Decoder[AvalaraTaxDetail] = deriveDecoder[AvalaraTaxDetail]
  
  implicit val avalaraLineResponseEncoder: Encoder[AvalaraLineResponse] = deriveEncoder[AvalaraLineResponse]
  implicit val avalaraLineResponseDecoder: Decoder[AvalaraLineResponse] = deriveDecoder[AvalaraLineResponse]
  
  implicit val avalaraSummaryItemEncoder: Encoder[AvalaraSummaryItem] = deriveEncoder[AvalaraSummaryItem]
  implicit val avalaraSummaryItemDecoder: Decoder[AvalaraSummaryItem] = deriveDecoder[AvalaraSummaryItem]
  
  implicit val avalaraTransactionResponseEncoder: Encoder[AvalaraTransactionResponse] = deriveEncoder[AvalaraTransactionResponse]
  implicit val avalaraTransactionResponseDecoder: Decoder[AvalaraTransactionResponse] = deriveDecoder[AvalaraTransactionResponse]
}
