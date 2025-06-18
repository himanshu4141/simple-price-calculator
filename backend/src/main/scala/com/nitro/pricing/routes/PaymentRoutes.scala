package com.nitro.pricing.routes

import com.nitro.pricing.services.StripeClient
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

class PaymentRoutes(stripeClient: StripeClient)(implicit ec: ExecutionContext) extends LazyLogging {

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
      }
    )
}
