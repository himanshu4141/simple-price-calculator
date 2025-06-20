package com.nitro.pricing.services

import com.nitro.pricing.config.AvalaraConfig
import com.nitro.pricing.models._
import com.nitro.pricing.models.JsonCodecs._
import com.typesafe.scalalogging.LazyLogging
import sttp.client3._
import sttp.client3.circe._
import scala.concurrent.{ExecutionContext, Future}
import java.util.{Base64, UUID}
import java.nio.charset.StandardCharsets

class AvalaraClient(config: AvalaraConfig)(implicit ec: ExecutionContext, backend: SttpBackend[Future, _]) extends LazyLogging {

  private val authHeader = {
    val credentials = s"${config.accountId}:${config.licenseKey}"
    val encoded = Base64.getEncoder.encodeToString(credentials.getBytes(StandardCharsets.UTF_8))
    s"Basic $encoded"
  }

  logger.info(s"AvalaraClient initialized - enabled: ${config.enabled}, baseUrl: ${config.baseUrl}")

  def calculateTax(request: TaxRequest): Future[TaxResponse] = {
    if (config.enabled && config.accountId.nonEmpty && config.licenseKey.nonEmpty && config.baseUrl.nonEmpty) {
      logger.info("Using real Avalara tax calculation via REST API")
      callAvalaraAPI(request)
    } else {
      val errorMsg = s"Avalara client not properly configured - enabled: ${config.enabled}, accountId: ${config.accountId.nonEmpty}, licenseKey: ${config.licenseKey.nonEmpty}, baseUrl: ${config.baseUrl.nonEmpty}"
      logger.error(errorMsg)
      Future.failed(new IllegalStateException(errorMsg))
    }
  }

  private def callAvalaraAPI(request: TaxRequest): Future[TaxResponse] = {
    val avalaraRequest = buildAvalaraRequest(request)
    
    val httpRequest = basicRequest
      .header("Authorization", authHeader)
      .header("Content-Type", "application/json")
      .header("Accept", "application/json")
      .body(avalaraRequest)
      .post(uri"${config.baseUrl}/api/v2/transactions/create")
      .response(asJson[AvalaraTransactionResponse])
      .readTimeout(config.timeout)
    
    backend.send(httpRequest).map { response =>
      response.body match {
        case Right(avalaraResponse) =>
          logger.info(s"✅ Avalara API success: transaction ${avalaraResponse.code}, total tax = ${avalaraResponse.totalTax}")
          convertAvalaraResponse(avalaraResponse, request.currency)
        case Left(error) =>
          val errorMsg = s"Avalara API returned error: $error"
          logger.error(errorMsg)
          throw new RuntimeException(errorMsg)
      }
    }.recover {
      case ex: Exception =>
        logger.error("❌ Avalara API call failed", ex)
        throw ex
    }
  }

  private def buildAvalaraRequest(request: TaxRequest): AvalaraCreateTransactionRequest = {
    val addresses = Map(
      "ShipFrom" -> AvalaraAddress(
        line1 = "548 Market St",
        city = "San Francisco", 
        region = "CA",
        postalCode = "94104",
        country = "US"
      ),
      "ShipTo" -> AvalaraAddress(
        line1 = request.customerAddress.line1,
        city = request.customerAddress.city,
        region = request.customerAddress.state,
        postalCode = request.customerAddress.postalCode,
        country = request.customerAddress.country
      )
    )
    
    val lines = request.lineItems.zipWithIndex.map { case (item, index) =>
      AvalaraLineItem(
        number = (index + 1).toString,
        description = item.description,
        amount = item.amount.amount,
        taxIncluded = false,
        taxCode = "SW054000", // Software as a Service
        itemCode = s"NITRO-ITEM-${index + 1}"
      )
    }
    
    AvalaraCreateTransactionRequest(
      code = s"NITRO-${UUID.randomUUID().toString}",
      date = java.time.LocalDate.now().toString,
      currencyCode = request.currency,
      addresses = addresses,
      lines = lines
    )
  }

  private def convertAvalaraResponse(avalaraResponse: AvalaraTransactionResponse, currency: String): TaxResponse = {
    // Convert line items
    val lineItemResponses = avalaraResponse.lines.map { line =>
      val subtotal = Money(line.lineAmount, currency)
      val taxAmount = Money(line.tax, currency)
      val total = Money(line.lineAmount + line.tax, currency)
      
      TaxLineItemResponse(
        description = line.description,
        subtotal = subtotal,
        taxAmount = taxAmount,
        total = total
      )
    }
    
    // Build tax breakdown from summary or line details
    val taxBreakdown = if (avalaraResponse.summary.nonEmpty) {
      avalaraResponse.summary.map { summary =>
        TaxBreakdownItem(
          name = summary.taxName,
          rate = summary.rate,
          amount = Money(summary.tax, currency),
          description = summary.jurisName
        )
      }
    } else if (avalaraResponse.lines.flatMap(_.details).nonEmpty) {
      // Fallback to line details if no summary
      avalaraResponse.lines.flatMap(_.details).groupBy(_.taxName).map { case (taxName, details) =>
        val totalRate = details.map(_.rate).sum / details.length // Average rate
        val totalAmount = details.map(_.tax).sum
        val jurisdiction = details.headOption.map(_.jurisName).getOrElse("Combined")
        
        TaxBreakdownItem(
          name = taxName,
          rate = totalRate,
          amount = Money(totalAmount, currency),
          description = jurisdiction
        )
      }.toList
    } else {
      // Final fallback
      if (avalaraResponse.totalTax > 0) {
        List(
          TaxBreakdownItem(
            name = "Sales Tax",
            rate = (avalaraResponse.totalTax / avalaraResponse.totalAmount) * 100,
            amount = Money(avalaraResponse.totalTax, currency),
            description = "Combined"
          )
        )
      } else {
        List.empty
      }
    }
    
    TaxResponse(
      totalTax = Money(avalaraResponse.totalTax, currency),
      taxBreakdown = taxBreakdown,
      lineItems = lineItemResponses
    )
  }
}
