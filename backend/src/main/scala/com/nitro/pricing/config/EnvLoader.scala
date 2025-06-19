package com.nitro.pricing.config

import io.github.cdimascio.dotenv.{Dotenv, DotenvException}
import com.typesafe.scalalogging.LazyLogging
import java.io.File

/**
 * Utility to load environment variables from .env file
 */
object EnvLoader extends LazyLogging {
  
  /**
   * Load environment variables from .env file in the backend directory
   * This should be called before any configuration loading
   */
  def loadEnvFile(): Unit = {
    try {
      // Get current working directory
      val currentDir = System.getProperty("user.dir")
      logger.info(s"Current working directory: $currentDir")
      
      // Look for .env file in current directory
      val envFile = new File(".env")
      
      logger.info(s"Looking for .env file at: ${envFile.getAbsolutePath}")
      logger.info(s".env file exists: ${envFile.exists()}")
      
      if (envFile.exists()) {
        logger.info(s"Loading environment variables from: ${envFile.getAbsolutePath}")
        
        val dotenv = Dotenv.configure()
          .directory(".")
          .ignoreIfMalformed()
          .ignoreIfMissing()
          .load()
        
        // Set system properties for variables that aren't already set
        dotenv.entries().forEach { entry =>
          val key = entry.getKey
          val value = entry.getValue
          
          // Only set if not already defined as system property or environment variable
          if (System.getProperty(key) == null && System.getenv(key) == null) {
            System.setProperty(key, value)
            logger.info(s"Set system property: $key = ${if (key.toLowerCase.contains("key") || key.toLowerCase.contains("secret")) "[REDACTED]" else value}")
            
            // Also set dotted properties for Typesafe Config
            key match {
              case "CHARGEBEE_SITE" => System.setProperty("chargebee.site", value)
              case "CHARGEBEE_API_KEY" => System.setProperty("chargebee.api-key", value)
              case "CHARGEBEE_GATEWAY_ACCOUNT_ID" => System.setProperty("chargebee.gateway-account-id", value)
              case "STRIPE_PUBLIC_KEY" => System.setProperty("stripe.public-key", value)
              case "STRIPE_SECRET_KEY" => System.setProperty("stripe.secret-key", value)
              case "STRIPE_WEBHOOK_SECRET" => System.setProperty("stripe.webhook-secret", value)
              case "AVALARA_BASE_URL" => System.setProperty("avalara.base-url", value)
              case "AVALARA_API_KEY" => System.setProperty("avalara.api-key", value)
              case _ => // No mapping needed
            }
          } else {
            logger.info(s"Environment variable $key already set, skipping .env value")
          }
        }
        
        logger.info(s"Successfully loaded ${dotenv.entries().size()} environment variables from .env file")
        
        // Verify key variables were loaded
        logger.info(s"CHARGEBEE_SITE from system property: ${System.getProperty("CHARGEBEE_SITE")}")
        logger.info(s"CHARGEBEE_SITE from environment: ${System.getenv("CHARGEBEE_SITE")}")
      } else {
        logger.warn(s"No .env file found at ${envFile.getAbsolutePath}, using system environment variables only")
      }
    } catch {
      case e: DotenvException =>
        logger.warn(s"Error loading .env file: ${e.getMessage}")
      case e: Exception =>
        logger.error("Unexpected error loading .env file", e)
    }
  }
}
