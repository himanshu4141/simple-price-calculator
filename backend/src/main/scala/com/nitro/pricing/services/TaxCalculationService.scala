package com.nitro.pricing.services

import com.nitro.pricing.models._
import com.nitro.pricing.config.AvalaraConfig
import com.typesafe.scalalogging.LazyLogging
import scala.concurrent.{ExecutionContext, Future}

class TaxCalculationService(config: AvalaraConfig)(implicit ec: ExecutionContext) extends LazyLogging {
  
  def calculateTax(request: TaxRequest): Future[TaxResponse] = {
    if (config.enabled) {
      // TODO: Real Avalara integration when sandbox is available
      logger.info("Real Avalara integration not yet implemented")
      calculateMockTax(request)
    } else {
      logger.debug(s"Calculating mock tax for ${request.customerAddress.country}")
      calculateMockTax(request)
    }
  }
  
  private def calculateMockTax(request: TaxRequest): Future[TaxResponse] = {
    Future {
      val country = request.customerAddress.country.toUpperCase
      val state = request.customerAddress.state.toUpperCase
      
      val taxRates = getMockTaxRates(country, state)
      val currency = request.currency
      
      val lineItemResponses = request.lineItems.map { item =>
        if (item.taxable) {
          val taxAmount = taxRates.foldLeft(BigDecimal(0)) { (acc, rate) =>
            acc + (item.amount.amount * rate.rate / 100)
          }
          
          TaxLineItemResponse(
            description = item.description,
            subtotal = item.amount,
            taxAmount = Money(taxAmount, currency),
            total = Money(item.amount.amount + taxAmount, currency)
          )
        } else {
          TaxLineItemResponse(
            description = item.description,
            subtotal = item.amount,
            taxAmount = Money(0, currency),
            total = item.amount
          )
        }
      }
      
      val totalTaxAmount = lineItemResponses.map(_.taxAmount.amount).sum
      
      TaxResponse(
        totalTax = Money(totalTaxAmount, currency),
        taxBreakdown = taxRates,
        lineItems = lineItemResponses
      )
    }
  }
  
  private def getMockTaxRates(country: String, state: String): List[TaxBreakdownItem] = {
    country match {
      case "US" | "USA" => getUSTaxRates(state)
      case "CA" | "CAN" | "CANADA" => getCanadaTaxRates(state)
      case "GB" | "UK" | "UNITED KINGDOM" => getUKTaxRates()
      case "AU" | "AUS" | "AUSTRALIA" => getAustraliaTaxRates()
      case "DE" | "FR" | "IT" | "ES" | "NL" | "BE" | "AT" | "PT" | "IE" | "FI" | "LU" => getEUTaxRates(country)
      case _ => getDefaultTaxRates()
    }
  }
  
  private def getUSTaxRates(state: String): List[TaxBreakdownItem] = {
    // Mock US tax rates (software subscriptions are generally not taxed federally)
    val stateTaxRate = state match {
      case "CA" | "CALIFORNIA" => BigDecimal("8.68") // CA average rate
      case "NY" | "NEW YORK" => BigDecimal("8.52") // NY average rate  
      case "TX" | "TEXAS" => BigDecimal("6.25") // TX state rate
      case "FL" | "FLORIDA" => BigDecimal("6.35") // FL average rate
      case "WA" | "WASHINGTON" => BigDecimal("6.50") // WA state rate
      case "OR" | "OREGON" => BigDecimal("0.00") // No sales tax
      case "MT" | "MONTANA" => BigDecimal("0.00") // No sales tax
      case "NH" | "NEW HAMPSHIRE" => BigDecimal("0.00") // No sales tax
      case "DE" | "DELAWARE" => BigDecimal("0.00") // No sales tax
      case _ => BigDecimal("7.25") // US average
    }
    
    if (stateTaxRate > 0) {
      List(
        TaxBreakdownItem("State Tax", stateTaxRate, Money(0, "USD"), s"$state State")
      )
    } else {
      List.empty
    }
  }
  
  private def getCanadaTaxRates(province: String): List[TaxBreakdownItem] = {
    province.toUpperCase match {
      case "AB" | "ALBERTA" => List(
        TaxBreakdownItem("GST", BigDecimal("5.00"), Money(0, "CAD"), "Federal")
      )
      case "BC" | "BRITISH COLUMBIA" => List(
        TaxBreakdownItem("GST", BigDecimal("5.00"), Money(0, "CAD"), "Federal"),
        TaxBreakdownItem("PST", BigDecimal("7.00"), Money(0, "CAD"), "BC")
      )
      case "ON" | "ONTARIO" => List(
        TaxBreakdownItem("HST", BigDecimal("13.00"), Money(0, "CAD"), "Federal + Provincial")
      )
      case "QC" | "QUEBEC" => List(
        TaxBreakdownItem("GST", BigDecimal("5.00"), Money(0, "CAD"), "Federal"),
        TaxBreakdownItem("QST", BigDecimal("9.975"), Money(0, "CAD"), "Quebec")
      )
      case _ => List(
        TaxBreakdownItem("GST", BigDecimal("5.00"), Money(0, "CAD"), "Federal")
      )
    }
  }
  
  private def getUKTaxRates(): List[TaxBreakdownItem] = {
    List(
      TaxBreakdownItem("VAT", BigDecimal("20.00"), Money(0, "GBP"), "UK")
    )
  }
  
  private def getAustraliaTaxRates(): List[TaxBreakdownItem] = {
    List(
      TaxBreakdownItem("GST", BigDecimal("10.00"), Money(0, "AUD"), "Australia")
    )
  }
  
  private def getEUTaxRates(country: String): List[TaxBreakdownItem] = {
    val vatRate = country match {
      case "DE" => BigDecimal("19.00") // Germany
      case "FR" => BigDecimal("20.00") // France  
      case "IT" => BigDecimal("22.00") // Italy
      case "ES" => BigDecimal("21.00") // Spain
      case "NL" => BigDecimal("21.00") // Netherlands
      case "BE" => BigDecimal("21.00") // Belgium
      case "AT" => BigDecimal("20.00") // Austria
      case "PT" => BigDecimal("23.00") // Portugal
      case "IE" => BigDecimal("23.00") // Ireland
      case "FI" => BigDecimal("24.00") // Finland
      case "LU" => BigDecimal("17.00") // Luxembourg
      case _ => BigDecimal("20.00") // EU average
    }
    
    List(
      TaxBreakdownItem("VAT", vatRate, Money(0, "EUR"), country)
    )
  }
  
  private def getDefaultTaxRates(): List[TaxBreakdownItem] = {
    // For countries not specifically handled, assume no tax on software subscriptions
    List.empty
  }
}
