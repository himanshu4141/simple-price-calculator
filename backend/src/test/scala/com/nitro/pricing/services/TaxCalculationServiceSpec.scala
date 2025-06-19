package com.nitro.pricing.services

import com.nitro.pricing.models._
import com.nitro.pricing.config.AvalaraConfig
import org.scalatest.flatspec.AsyncFlatSpec
import org.scalatest.matchers.should.Matchers
import scala.concurrent.duration._

class TaxCalculationServiceSpec extends AsyncFlatSpec with Matchers {

  val mockConfig = AvalaraConfig(enabled = false, None, None, 30.seconds)
  val taxService = new TaxCalculationService(mockConfig)

  "TaxCalculationService" should "calculate US tax correctly" in {
    val request = TaxRequest(
      customerAddress = Address(
        line1 = "123 Main St",
        city = "San Francisco", 
        state = "CA",
        postalCode = "94105",
        country = "US"
      ),
      lineItems = List(
        TaxLineItem("Nitro PDF Plus", Money(100.00, "USD"))
      ),
      currency = "USD"
    )

    taxService.calculateTax(request).map { result =>
      result.totalTax.amount should be > BigDecimal(0)
      result.taxBreakdown should not be empty
      result.lineItems should have size 1
    }
  }

  it should "calculate no tax for Oregon (no sales tax)" in {
    val request = TaxRequest(
      customerAddress = Address(
        line1 = "123 Main St",
        city = "Portland",
        state = "OR", 
        postalCode = "97201",
        country = "US"
      ),
      lineItems = List(
        TaxLineItem("Nitro PDF Plus", Money(100.00, "USD"))
      ),
      currency = "USD"
    )

    taxService.calculateTax(request).map { result =>
      result.totalTax.amount shouldEqual BigDecimal(0)
      result.taxBreakdown should be(empty)
    }
  }

  it should "calculate UK VAT correctly" in {
    val request = TaxRequest(
      customerAddress = Address(
        line1 = "123 Main St",
        city = "London",
        state = "England",
        postalCode = "SW1A 1AA", 
        country = "GB"
      ),
      lineItems = List(
        TaxLineItem("Nitro PDF Plus", Money(100.00, "GBP"))
      ),
      currency = "GBP"
    )

    taxService.calculateTax(request).map { result =>
      result.totalTax.amount shouldEqual BigDecimal(20.00) // 20% VAT
      result.taxBreakdown should have size 1
      result.taxBreakdown.head.rate shouldEqual BigDecimal("20.00")
    }
  }
}
