package com.nitro.pricing.routes

import com.nitro.pricing.services.{StripeClient, CheckoutService}
import com.nitro.pricing.models.JsonCodecs._
import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.Route
import org.apache.pekko.http.scaladsl.model.StatusCodes
import io.circe.syntax._
import io.circe.generic.auto._
import org.mdedetrich.pekko.http.support.CirceHttpSupport._
import com.typesafe.scalalogging.LazyLogging

import scala.concurrent.ExecutionContext

case class CreatePaymentIntentRequest(
  amount: Long, // Amount in cents
  currency: String
)

case class CreatePaymentIntentResponse(
  clientSecret: String,
  paymentIntentId: String
)

case class CreateSetupIntentRequest(
  customerId: Option[String] = None,
  paymentMethodTypes: List[String] = List("card")
)

case class CreateSetupIntentResponse(
  clientSecret: String,
  setupIntentId: String
)

case class ConfirmPaymentRequest(
  customerId: String,
  subscriptionId: String,
  paymentIntentId: String
)

class PaymentRoutes(stripeClient: StripeClient, checkoutService: CheckoutService)(implicit ec: ExecutionContext) extends LazyLogging {

  val routes: Route =
    concat(
      path("create-payment-intent") {
        post {
          entity(as[CreatePaymentIntentRequest]) { request =>
            logger.info(s"Creating payment intent: ${request.amount} ${request.currency}")
            onSuccess(stripeClient.createPaymentIntent(
              amount = request.amount,
              currency = request.currency
            )) {
              case Right(paymentIntent) =>
                val response = CreatePaymentIntentResponse(
                  clientSecret = paymentIntent.getClientSecret,
                  paymentIntentId = paymentIntent.getId
                )
                complete(StatusCodes.OK, response)
              case Left(error) =>
                logger.error(s"Failed to create payment intent: $error")
                complete(StatusCodes.InternalServerError, Map("error" -> error))
            }
          }
        }
      },
      path("setup-intent") {
        post {
          entity(as[CreateSetupIntentRequest]) { request =>
            logger.info(s"[SETUP_INTENT] Request received for customer: ${request.customerId}")
            onSuccess(stripeClient.createSetupIntent(
              customerId = request.customerId,
              paymentMethodTypes = request.paymentMethodTypes
            )) {
              case Right(setupIntent) =>
                val response = CreateSetupIntentResponse(
                  clientSecret = setupIntent.getClientSecret,
                  setupIntentId = setupIntent.getId
                )
                logger.info(s"[SETUP_INTENT] Created SetupIntent: id=${setupIntent.getId}, clientSecret=${setupIntent.getClientSecret}, status=${setupIntent.getStatus}")
                complete(StatusCodes.OK, response)
              case Left(error) =>
                logger.error(s"[SETUP_INTENT] Failed to create setup intent: $error")
                complete(StatusCodes.InternalServerError, Map("error" -> error))
            }
          }
        }
      },
      path("confirm-payment") {
        post {
          entity(as[ConfirmPaymentRequest]) { request =>
            logger.info(s"Confirming payment: ${request.paymentIntentId} for customer: ${request.customerId}")
            onSuccess(checkoutService.confirmPaymentAndActivateSubscription(
              customerId = request.customerId,
              subscriptionId = request.subscriptionId,
              paymentIntentId = request.paymentIntentId
            )) { response =>
              if (response.success) {
                complete(StatusCodes.OK, response)
              } else {
                complete(StatusCodes.BadRequest, response)
              }
            }
          }
        }
      }
    )
}
