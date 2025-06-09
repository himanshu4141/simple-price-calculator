package com.nitro.pricing.services

import com.nitro.pricing.models._
import com.nitro.pricing.models.JsonCodecs._
import com.typesafe.scalalogging.LazyLogging

import scala.concurrent.{ExecutionContext, Future}

class CheckoutService(
  chargebeeClient: ChargebeeClient,
  taxCalculationService: TaxCalculationService
)(implicit ec: ExecutionContext) extends LazyLogging {

  def processCheckout(request: CheckoutRequest): Future[CheckoutResponse] = {
    logger.info(s"Processing checkout for customer: ${request.customer.email}, ${request.items.length} items, term: ${request.billingTerm}")
    
    // Business rule: Reject 3-year terms and direct to sales
    if (request.billingTerm.toLowerCase.contains("3")) {
      logger.info(s"3-year term detected for ${request.customer.email}, directing to sales contact")
      return Future.successful(CheckoutResponse(
        success = false,
        customerId = "",
        subscriptionId = None,
        hostedPageUrl = None,
        message = "3-year subscriptions require sales assistance. Please contact our sales team for a custom quote.",
        salesContactRequired = true
      ))
    }

    // Process 1-year terms through Chargebee
    for {
      customerResult <- chargebeeClient.createCustomer(request.customer, request.billingAddress)
      checkoutResult <- customerResult match {
        case Right(chargebeeCustomer) =>
          processSubscriptionCreation(chargebeeCustomer.id, request.items, request.currency)
        case Left(error) =>
          logger.error(s"Customer creation failed: $error")
          Future.successful(CheckoutResponse(
            success = false,
            customerId = "",
            subscriptionId = None,
            hostedPageUrl = None,
            message = s"Customer creation failed: $error",
            salesContactRequired = false
          ))
      }
    } yield checkoutResult
  }

  private def processSubscriptionCreation(customerId: String, requestedItems: List[CheckoutItem], currency: String): Future[CheckoutResponse] = {
    // According to PLANNING.md, we need:
    // 1. Base subscription container: Chargebee_susbcription_plan ($0)
    // 2. Actual product items as additional items
    
    val subscriptionContainerId = s"Chargebee_susbcription_plan-${currency.toUpperCase}-1_YEAR"
    
    val allItems = CheckoutItem(subscriptionContainerId, 1) :: requestedItems
    
    logger.info(s"Creating subscription with ${allItems.length} items: base container + ${requestedItems.length} product items")
    
    chargebeeClient.createSubscription(customerId, allItems).map {
      case Right(subscription) =>
        logger.info(s"✅ Checkout completed successfully - Customer: $customerId, Subscription: ${subscription.id}")
        CheckoutResponse(
          success = true,
          customerId = customerId,
          subscriptionId = Some(subscription.id),
          hostedPageUrl = None, // Could be added later for hosted payment pages
          message = "Subscription created successfully",
          salesContactRequired = false
        )
      case Left(error) =>
        logger.error(s"❌ Subscription creation failed for customer $customerId: $error")
        CheckoutResponse(
          success = false,
          customerId = customerId,
          subscriptionId = None,
          hostedPageUrl = None,
          message = s"Subscription creation failed: $error",
          salesContactRequired = false
        )
    }
  }

  def calculateCheckoutTax(request: CheckoutRequest, subtotal: Money): Future[Either[String, TaxResponse]] = {
    logger.info(s"Calculating tax for checkout: ${request.customer.email}, subtotal: ${subtotal.amount} ${subtotal.currency}")
    
    val customerAddress = Address(
      line1 = request.billingAddress.line1,
      line2 = request.billingAddress.line2,
      city = request.billingAddress.city,
      state = request.billingAddress.state,
      postalCode = request.billingAddress.postalCode,
      country = request.billingAddress.country
    )

    val lineItems = List(TaxLineItem(
      description = "Subscription charges",
      amount = subtotal,
      taxable = true
    ))

    val taxRequest = TaxRequest(
      customerAddress = customerAddress,
      lineItems = lineItems,
      currency = subtotal.currency
    )

    taxCalculationService.calculateTax(taxRequest).map(Right(_)).recover {
      case ex =>
        logger.error(s"❌ Tax calculation failed: ${ex.getMessage}")
        Left(s"Tax calculation failed: ${ex.getMessage}")
    }
  }
}
