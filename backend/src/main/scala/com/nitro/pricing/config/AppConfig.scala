package com.nitro.pricing.config

import com.typesafe.config.{Config, ConfigFactory}
import scala.concurrent.duration._
import scala.jdk.DurationConverters._

case class ServerConfig(host: String, port: Int, requestTimeout: FiniteDuration)

case class ChargebeeConfig(
  site: String,
  apiKey: String,
  gatewayAccountId: String,
  baseUrl: String,
  timeout: FiniteDuration,
  maxRetryAttempts: Int,
  retryBackoff: FiniteDuration
)

case class StripeConfig(
  publicKey: String,
  secretKey: String,
  timeout: FiniteDuration
)

case class AvalaraConfig(
  enabled: Boolean,
  baseUrl: Option[String],
  apiKey: Option[String],
  timeout: FiniteDuration
)

case class CacheConfig(
  pricingTtl: FiniteDuration,
  maxEntries: Int
)

case class FeatureFlags(
  useRealAvalara: Boolean,
  enableWebhooks: Boolean,
  enable3YearCheckout: Boolean
)

case class AppConfig(
  server: ServerConfig,
  chargebee: ChargebeeConfig,
  stripe: StripeConfig,
  avalara: AvalaraConfig,
  cache: CacheConfig,
  features: FeatureFlags
) {
  val name = "nitro-price-calculator-api"
  val version = "1.0.0"
  val environment = Option(System.getenv("ENVIRONMENT")).getOrElse("development")
}

object AppConfig {
  def load(): AppConfig = {
    val config = ConfigFactory.load()
    
    // Helper function to get string with fallback
    def getStringWithFallback(path: String, fallback: String): String = {
      if (config.hasPath(path)) config.getString(path) else fallback
    }
    
    AppConfig(
      server = ServerConfig(
        host = config.getString("server.host"),
        port = config.getInt("server.port"),
        requestTimeout = config.getDuration("server.request-timeout").toScala
      ),
      chargebee = ChargebeeConfig(
        site = getStringWithFallback("chargebee.site", "test-site"),
        apiKey = getStringWithFallback("chargebee.api-key", "test-key"),
        gatewayAccountId = getStringWithFallback("chargebee.gateway-account-id", "stripe"),
        baseUrl = config.getString("chargebee.base-url"),
        timeout = config.getDuration("chargebee.timeout").toScala,
        maxRetryAttempts = config.getInt("chargebee.retry.max-attempts"),
        retryBackoff = config.getDuration("chargebee.retry.backoff").toScala
      ),
      stripe = StripeConfig(
        publicKey = getStringWithFallback("stripe.public-key", "pk_test_default"),
        secretKey = getStringWithFallback("stripe.secret-key", "sk_test_default"),
        timeout = config.getDuration("stripe.timeout").toScala
      ),
      avalara = AvalaraConfig(
        enabled = config.getBoolean("avalara.enabled"),
        baseUrl = if (config.hasPath("avalara.base-url")) Some(config.getString("avalara.base-url")) else None,
        apiKey = if (config.hasPath("avalara.api-key")) Some(config.getString("avalara.api-key")) else None,
        timeout = config.getDuration("avalara.timeout").toScala
      ),
      cache = CacheConfig(
        pricingTtl = config.getDuration("cache.pricing.ttl").toScala,
        maxEntries = config.getInt("cache.pricing.max-entries")
      ),
      features = FeatureFlags(
        useRealAvalara = config.getBoolean("features.use-real-avalara"),
        enableWebhooks = config.getBoolean("features.enable-webhooks"),
        enable3YearCheckout = config.getBoolean("features.enable-3year-checkout")
      )
    )
  }
}
