package com.nitro.pricing

import org.apache.pekko.actor.typed.ActorSystem
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.http.scaladsl.Http
import org.apache.pekko.http.scaladsl.server.Route
import com.nitro.pricing.config.{AppConfig, EnvLoader}
import com.nitro.pricing.services.{ChargebeeClient, TaxCalculationService, PricingService}
import com.nitro.pricing.routes.ApiRoutes
import com.typesafe.scalalogging.LazyLogging
import sttp.client3._
import sttp.client3.asynchttpclient.future.AsyncHttpClientFutureBackend
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.ExecutionContext
import scala.util.{Failure, Success}

object Main extends App with LazyLogging {
  
  // Load environment variables from .env file first
  EnvLoader.loadEnvFile()
  
  // Load configuration
  val config = AppConfig.load()
  logger.info(s"Starting ${config.name} v${config.version} in ${config.environment} mode")

  // Create actor system
  implicit val system: ActorSystem[Nothing] = ActorSystem(Behaviors.empty, "nitro-pricing-system")
  implicit val ec: ExecutionContext = system.executionContext

  // Create HTTP client backend
  implicit val backend: SttpBackend[Future, Any] = AsyncHttpClientFutureBackend()

  // Initialize services
  val chargebeeClient = new ChargebeeClient(config.chargebee)
  val taxService = new TaxCalculationService(config.avalara)
  val pricingService = new PricingService(chargebeeClient)
  
  // Initialize routes
  val apiRoutes = new ApiRoutes(chargebeeClient, taxService, pricingService)
  val routes: Route = apiRoutes.routes

  // Start HTTP server
  val bindingFuture = Http().newServerAt(config.server.host, config.server.port).bind(routes)

  bindingFuture.onComplete {
    case Success(binding) =>
      val address = binding.localAddress
      logger.info(s"Server online at http://${address.getHostString}:${address.getPort}/")
      logger.info("API endpoints available:")
      logger.info("  GET  /api/health - Health check")
      logger.info("  GET  /api/pricing - Fetch pricing data (hybrid Chargebee + static)")
      logger.info("  POST /api/estimate - Calculate price estimates")
      logger.info("  GET  /api/chargebee/discovery - Discover Chargebee products")

      
      // Log configuration info
      logger.info(s"Chargebee site: ${config.chargebee.site}")
      logger.info(s"Avalara enabled: ${config.avalara.enabled}")
      logger.info(s"Feature flags: useRealAvalara=${config.features.useRealAvalara}, enable3YearCheckout=${config.features.enable3YearCheckout}")
      
    case Failure(ex) =>
      logger.error("Failed to bind HTTP server", ex)
      system.terminate()
  }

  // Graceful shutdown
  sys.addShutdownHook {
    logger.info("Shutting down server...")
    bindingFuture
      .flatMap(_.unbind())
      .onComplete { _ =>
        backend.close()
        system.terminate()
      }
  }

  // Keep the main thread alive - wait for server termination
  scala.concurrent.Await.ready(system.whenTerminated, scala.concurrent.duration.Duration.Inf)
}
