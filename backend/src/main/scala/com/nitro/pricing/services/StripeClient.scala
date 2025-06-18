package com.nitro.pricing.services

import com.nitro.pricing.models._
import com.nitro.pricing.config.StripeConfig
import com.stripe.Stripe
import com.stripe.model.{Customer => StripeCustomer, PaymentIntent, PaymentMethod, SetupIntent}
import com.stripe.param.{CustomerCreateParams, PaymentIntentCreateParams, PaymentIntentConfirmParams, SetupIntentCreateParams, SetupIntentConfirmParams}
import com.typesafe.scalalogging.LazyLogging

import scala.concurrent.{ExecutionContext, Future}
import scala.jdk.CollectionConverters._
import scala.util.{Failure, Success, Try}

/**
 * StripeClient - Handles Stripe API interactions for payment processing
 * 
 * ACTIVE METHODS:
 * - createPaymentIntent: Used by PaymentRoutes for standalone payment intents
 * - createSetupIntent: Used by PaymentRoutes for collecting payment methods
 * - createAndConfirmPaymentIntent: Used by CheckoutService for Chargebee 3DS integration
 * 
 * Note: All deprecated methods have been removed to clean up the codebase.
 * Removed methods included: confirmPaymentIntent, getPaymentIntent, createStripeCustomer,
 * getPaymentMethod, confirmSetupIntent, getSetupIntent, createPaymentMethodFromToken,
 * centesToMoney, and moneyToCents.
 */
class StripeClient(config: StripeConfig)(implicit ec: ExecutionContext) extends LazyLogging {
  
  private val secretKey = config.secretKey
  
  // Initialize Stripe with secret key
  Stripe.apiKey = secretKey
  
  logger.info("StripeClient initialized successfully")

  /**
   * Create a PaymentIntent for the given amount and customer
   */
  def createPaymentIntent(
    amount: Long, // Amount in cents
    currency: String,
    customerId: Option[String] = None,
    paymentMethodId: Option[String] = None,
    automaticPaymentMethods: Boolean = true,
    captureMethod: Option[String] = None,
    setupFutureUsage: Option[String] = None
  ): Future[Either[String, PaymentIntent]] = {
    Future {
      Try {
        logger.info(s"Creating PaymentIntent: amount=$amount cents, currency=$currency, customer=$customerId")
        
        val paramsBuilder = PaymentIntentCreateParams.builder()
          .setAmount(amount)
          .setCurrency(currency.toLowerCase)
        
        // Only set confirmation method if NOT using automatic payment methods
        if (!automaticPaymentMethods) {
          paramsBuilder.setConfirmationMethod(PaymentIntentCreateParams.ConfirmationMethod.MANUAL)
        }
        
        // Add customer if provided
        customerId.foreach(paramsBuilder.setCustomer)
        
        // Add payment method if provided
        paymentMethodId.foreach(paramsBuilder.setPaymentMethod)
        
        // Set capture method if provided
        captureMethod.foreach { method =>
          val captureMethodEnum = method.toLowerCase match {
            case "manual" => PaymentIntentCreateParams.CaptureMethod.MANUAL
            case "automatic" => PaymentIntentCreateParams.CaptureMethod.AUTOMATIC
            case _ => PaymentIntentCreateParams.CaptureMethod.AUTOMATIC
          }
          paramsBuilder.setCaptureMethod(captureMethodEnum)
          logger.info(s"Setting capture method: $method")
        }
        
        // Set setup future usage if provided
        setupFutureUsage.foreach { usage =>
          val usageEnum = usage.toLowerCase match {
            case "off_session" => PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION
            case "on_session" => PaymentIntentCreateParams.SetupFutureUsage.ON_SESSION
            case _ => PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION
          }
          paramsBuilder.setSetupFutureUsage(usageEnum)
          logger.info(s"Setting setup future usage: $usage")
        }
        
        // Enable automatic payment methods if requested
        if (automaticPaymentMethods) {
          paramsBuilder.setAutomaticPaymentMethods(
            PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
              .setEnabled(true)
              .setAllowRedirects(PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER) // Disable redirects for simpler flow
              .build()
          )
        }
        
        // Add metadata for tracking
        paramsBuilder.putMetadata("source", "nitro-price-calculator")
        paramsBuilder.putMetadata("integration", "chargebee-stripe")
        
        val paymentIntent = PaymentIntent.create(paramsBuilder.build())
        logger.info(s"✅ PaymentIntent created successfully: ${paymentIntent.getId}")
        paymentIntent
        
      } match {
        case Success(paymentIntent) => Right(paymentIntent)
        case Failure(exception) =>
          val errorMsg = s"Failed to create PaymentIntent: ${exception.getMessage}"
          logger.error(errorMsg, exception)
          Left(errorMsg)
      }
    }
  }

  /**
   * Create a SetupIntent for collecting payment method for future payments
   * This is required for Payment Elements to work properly
   */
  def createSetupIntent(
    customerId: Option[String] = None,
    paymentMethodTypes: List[String] = List("card")
  ): Future[Either[String, SetupIntent]] = {
    Future {
      Try {
        logger.info(s"Creating SetupIntent for future payments, customer=$customerId")
        
        val paramsBuilder = SetupIntentCreateParams.builder()
          .setUsage(SetupIntentCreateParams.Usage.OFF_SESSION) // For future payments
        
        // Add customer if provided
        customerId.foreach(paramsBuilder.setCustomer)
        
        // Set payment method types
        paramsBuilder.addAllPaymentMethodType(paymentMethodTypes.asJava)
        
        // Add metadata for tracking
        paramsBuilder.putMetadata("source", "nitro-price-calculator")
        paramsBuilder.putMetadata("integration", "chargebee-stripe")
        paramsBuilder.putMetadata("purpose", "payment-method-collection")
        
        val setupIntent = SetupIntent.create(paramsBuilder.build())
        logger.info(s"✅ SetupIntent created successfully: ${setupIntent.getId}")
        setupIntent
        
      } match {
        case Success(setupIntent: SetupIntent) => Right(setupIntent)
        case Failure(exception) =>
          val errorMsg = s"Failed to create SetupIntent: ${exception.getMessage}"
          logger.error(errorMsg, exception)
          Left(errorMsg)
      }
    }
  }

  /**
   * Create a PaymentIntent for Chargebee 3DS flow (without immediate confirmation)
   * Following the official Chargebee + Stripe integration pattern
   */
  def createAndConfirmPaymentIntent(
    amount: Long, // Amount in cents
    currency: String,
    paymentMethodId: String,
    captureMethod: String = "manual",
    confirmationMethod: String = "manual",
    setupFutureUsage: String = "off_session"
  ): Future[Either[String, PaymentIntent]] = {
    Future {
      Try {
        logger.info(s"Creating and confirming PaymentIntent for Chargebee: amount=$amount cents, currency=$currency, paymentMethod=$paymentMethodId")
        
        val paramsBuilder = PaymentIntentCreateParams.builder()
          .setAmount(amount)
          .setCurrency(currency.toLowerCase)
          .setPaymentMethod(paymentMethodId)
          .setConfirm(true) // Confirm immediately so it's in requires_capture state for Chargebee
          .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.MANUAL) // As per Chargebee sample
          // Note: Can't use confirmation_method when automatic_payment_methods is enabled
        
        // Fix for Stripe PaymentIntent redirect error: set automatic_payment_methods with allow_redirects=never
        paramsBuilder.setAutomaticPaymentMethods(
          PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
            .setEnabled(true)
            .setAllowRedirects(PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER)
            .build()
        )
        
        // Set setup future usage
        val usageEnum = setupFutureUsage.toLowerCase match {
          case "off_session" => PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION
          case "on_session" => PaymentIntentCreateParams.SetupFutureUsage.ON_SESSION
          case _ => PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION
        }
        paramsBuilder.setSetupFutureUsage(usageEnum)
        
        // Add metadata for tracking
        paramsBuilder.putMetadata("source", "nitro-price-calculator")
        paramsBuilder.putMetadata("integration", "chargebee-stripe-3ds")
        paramsBuilder.putMetadata("flow", "payment-intent-confirm")
        
        val paymentIntent = PaymentIntent.create(paramsBuilder.build())
        logger.info(s"✅ PaymentIntent created and confirmed: ${paymentIntent.getId}, status: ${paymentIntent.getStatus}")
        paymentIntent
        
      } match {
        case Success(paymentIntent) => Right(paymentIntent)
        case Failure(exception) =>
          val errorMsg = s"Failed to create PaymentIntent: ${exception.getMessage}"
          logger.error(errorMsg, exception)
          Left(errorMsg)
      }
    }
  }
}
