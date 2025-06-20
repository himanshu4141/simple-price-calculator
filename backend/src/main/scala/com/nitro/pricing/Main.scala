package com.nitro.pricing

import org.apache.pekko.actor.typed.ActorSystem
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.http.scaladsl.Http
import org.apache.pekko.http.scaladsl.server.Route
import com.nitro.pricing.config.{AppConfig, EnvLoader}
import com.nitro.pricing.services.{ChargebeeClient, TaxCalculationService, PricingService, CheckoutService, StripeClient}
import com.nitro.pricing.routes.{ApiRoutes}
import com.typesafe.scalalogging.LazyLogging
import sttp.client3._
import sttp.client3.asynchttpclient.future.AsyncHttpClientFutureBackend
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.ExecutionContext
import scala.util.{Failure, Success}

object Main extends App with LazyLogging {
  
  logger.info("=== STARTING NITRO PRICE CALCULATOR API ===")
  
  // Log environment information
  logger.info(s"Java version: ${System.getProperty("java.version")}")
  logger.info(s"Working directory: ${System.getProperty("user.dir")}")
  logger.info(s"User home: ${System.getProperty("user.home")}")
  
  // Log critical environment variables before loading .env
  logger.info("=== ENVIRONMENT VARIABLES BEFORE .env LOADING ===")
  val criticalEnvVars = List(
    "PORT", "ENVIRONMENT", 
    "CHARGEBEE_SITE", "CHARGEBEE_API_KEY", "CHARGEBEE_GATEWAY_ACCOUNT_ID",
    "STRIPE_PUBLIC_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "AVALARA_ENABLED", "AVALARA_BASE_URL", "AVALARA_API_KEY",
    "FEATURES_ENABLE_WEBHOOKS", "FEATURES_ENABLE_3YEAR_CHECKOUT"
  )
  
  criticalEnvVars.foreach { envVar =>
    val systemEnv = System.getenv(envVar)
    val systemProp = System.getProperty(envVar)
    logger.info(f"$envVar%-30s | ENV: ${Option(systemEnv).getOrElse("NOT_SET")}%-20s | PROP: ${Option(systemProp).getOrElse("NOT_SET")}")
  }
  
  // Load environment variables from .env file first
  logger.info("=== LOADING .env FILE ===")
  EnvLoader.loadEnvFile()
  
  // Log critical environment variables after loading .env
  logger.info("=== ENVIRONMENT VARIABLES AFTER .env LOADING ===")
  criticalEnvVars.foreach { envVar =>
    val systemEnv = System.getenv(envVar)
    val systemProp = System.getProperty(envVar)
    logger.info(f"$envVar%-30s | ENV: ${Option(systemEnv).getOrElse("NOT_SET")}%-20s | PROP: ${Option(systemProp).getOrElse("NOT_SET")}")
  }
  
  // Log Typesafe Config dotted properties
  logger.info("=== TYPESAFE CONFIG PROPERTIES ===")
  val configProps = List(
    "server.host", "server.port",
    "chargebee.site", "chargebee.api-key", "chargebee.gateway-account-id",
    "stripe.public-key", "stripe.secret-key",
    "avalara.enabled"
  )
  
  configProps.foreach { prop =>
    val value = System.getProperty(prop)
    val maskedValue = if (prop.contains("key") || prop.contains("secret")) "[REDACTED]" else value
    logger.info(f"$prop%-30s | ${Option(maskedValue).getOrElse("NOT_SET")}")
  }
  
  // Load configuration
  logger.info("=== LOADING APPLICATION CONFIGURATION ===")
  try {
    val config = AppConfig.load()
    logger.info(s"✅ Configuration loaded successfully")
    logger.info(s"Starting ${config.name} v${config.version} in ${config.environment} mode")
    
    // Log the loaded configuration (with sensitive data masked)
    logger.info("=== LOADED CONFIGURATION ===")
    logger.info(s"Server: ${config.server.host}:${config.server.port}")
    logger.info(s"Chargebee site: ${config.chargebee.site}")
    logger.info(s"Chargebee API key: ${if (config.chargebee.apiKey.nonEmpty) "[REDACTED]" else "NOT_SET"}")
    logger.info(s"Chargebee gateway: ${config.chargebee.gatewayAccountId}")
    logger.info(s"Chargebee base URL: ${config.chargebee.baseUrl}")
    logger.info(s"Stripe public key: ${config.stripe.publicKey}")
    logger.info(s"Stripe secret key: ${if (config.stripe.secretKey.nonEmpty) "[REDACTED]" else "NOT_SET"}")
    logger.info(s"Avalara enabled: ${config.avalara.enabled}")
    logger.info(s"Feature flags: enableWebhooks=${config.features.enableWebhooks}, enable3YearCheckout=${config.features.enable3YearCheckout}")
    
    // Validate critical configuration
    logger.info("=== CONFIGURATION VALIDATION ===")
    if (config.chargebee.site == "test-site") {
      logger.warn("⚠️  Using fallback Chargebee site 'test-site' - check CHARGEBEE_SITE environment variable")
    }
    if (config.chargebee.apiKey == "test-key") {
      logger.warn("⚠️  Using fallback Chargebee API key 'test-key' - check CHARGEBEE_API_KEY environment variable")
    }
    if (config.stripe.secretKey == "sk_test_default") {
      logger.warn("⚠️  Using fallback Stripe secret key - check STRIPE_SECRET_KEY environment variable")
    }
    
    startApplication(config)
    
  } catch {
    case ex: Exception =>
      logger.error("❌ Failed to load configuration", ex)
      System.exit(1)
  }

  private def startApplication(config: AppConfig): Unit = {
    logger.info("=== STARTING APPLICATION SERVICES ===")
    
    // Create actor system
    implicit val system: ActorSystem[Nothing] = ActorSystem(Behaviors.empty, "nitro-pricing-system")
    implicit val ec: ExecutionContext = system.executionContext

    // Create HTTP client backend
    implicit val backend: SttpBackend[Future, Any] = AsyncHttpClientFutureBackend()

    // Initialize services
    logger.info("Initializing Chargebee client...")
    val chargebeeClient = new ChargebeeClient(config.chargebee)
    
    logger.info("Initializing Stripe client...")
    val stripeClient = new StripeClient(config.stripe)
    
    logger.info("Initializing tax service...")
    val taxService = new TaxCalculationService(config.avalara)
    
    logger.info("Initializing pricing service...")
    val pricingService = new PricingService(chargebeeClient)
    
    logger.info("Initializing checkout service...")
    val checkoutService = new CheckoutService(chargebeeClient, taxService, stripeClient)
    
    // Initialize routes
    logger.info("Initializing API routes...")
    val apiRoutes = new ApiRoutes(chargebeeClient, taxService, pricingService, checkoutService, stripeClient)
    val routes: Route = apiRoutes.routes

    // Start HTTP server
    logger.info(s"=== STARTING HTTP SERVER ===")
    logger.info(s"Binding to ${config.server.host}:${config.server.port}")
    val bindingFuture = Http().newServerAt(config.server.host, config.server.port).bind(routes)

    bindingFuture.onComplete {
      case Success(binding) =>
        val address = binding.localAddress
        logger.info(s"🚀 Server online at http://${address.getHostString}:${address.getPort}/")
        logger.info("=== API ENDPOINTS AVAILABLE ===")
        logger.info("  GET  / - Root endpoint (connectivity test)")
        logger.info("  GET  /api/health - Health check")
        logger.info("  GET  /api/pricing - Fetch pricing data (hybrid Chargebee + static)")
        logger.info("  POST /api/estimate - Calculate price estimates")
        logger.info("  POST /api/taxes - Calculate tax amounts")
        logger.info("  POST /api/checkout - Process subscription checkout")
        logger.info("  GET  /api/chargebee/discovery - Discover Chargebee products")

        logger.info("=== CONFIGURATION SUMMARY ===")
        logger.info(s"📍 Server: ${address.getHostString}:${address.getPort}")
        logger.info(s"🏢 Chargebee site: ${config.chargebee.site}")
        logger.info(s"🔐 Chargebee API configured: ${config.chargebee.apiKey != "test-key"}")
        logger.info(s"💳 Stripe configured: ${config.stripe.secretKey != "sk_test_default"}")
        logger.info(s"📊 Avalara enabled: ${config.avalara.enabled}")
        logger.info(s"🎛️  Feature flags: enableWebhooks=${config.features.enableWebhooks}, enable3YearCheckout=${config.features.enable3YearCheckout}")
        
        logger.info("=== STARTUP COMPLETE ===")
        
      case Failure(ex) =>
        logger.error("❌ Failed to bind HTTP server", ex)
        system.terminate()
    }

    // Graceful shutdown
    sys.addShutdownHook {
      logger.info("🛑 Shutdown signal received, stopping server...")
      bindingFuture
        .flatMap(_.unbind())
        .onComplete { _ =>
          logger.info("📡 HTTP server unbound")
          backend.close()
          logger.info("🔌 HTTP client closed")
          system.terminate()
          logger.info("🏁 Application shutdown complete")
        }
    }

    // Keep the main thread alive - wait for server termination
    scala.concurrent.Await.ready(system.whenTerminated, scala.concurrent.duration.Duration.Inf)
  }
}
