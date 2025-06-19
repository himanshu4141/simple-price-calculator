ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "2.13.12"

lazy val root = (project in file("."))
  .settings(
    name := "nitro-price-calculator-api",
    libraryDependencies ++= Seq(
      // Pekko HTTP
      "org.apache.pekko" %% "pekko-http" % "1.2.0",
      "org.apache.pekko" %% "pekko-stream" % "1.1.3",
      "org.apache.pekko" %% "pekko-actor-typed" % "1.1.3",
      "org.apache.pekko" %% "pekko-slf4j" % "1.1.3",
      
      // JSON support with Circe
      "io.circe" %% "circe-core" % "0.14.6",
      "io.circe" %% "circe-generic" % "0.14.6",
      "io.circe" %% "circe-parser" % "0.14.6",
      "org.mdedetrich" %% "pekko-http-circe" % "1.1.0",
      
      // Cats for functional programming
      "org.typelevel" %% "cats-core" % "2.10.0",
      "org.typelevel" %% "cats-effect" % "3.5.4",
      
      // HTTP client for external APIs
      "com.softwaremill.sttp.client3" %% "core" % "3.9.2",
      "com.softwaremill.sttp.client3" %% "circe" % "3.9.2",
      "com.softwaremill.sttp.client3" %% "async-http-client-backend-future" % "3.9.2",
      
      // Configuration
      "com.typesafe" % "config" % "1.4.3",
      "io.github.cdimascio" % "dotenv-java" % "3.0.0",
      
      // Stripe SDK
      "com.stripe" % "stripe-java" % "29.2.0",
      
      // Logging
      "ch.qos.logback" % "logback-classic" % "1.4.14",
      "com.typesafe.scala-logging" %% "scala-logging" % "3.9.5",
      
      // Testing
      "org.scalatest" %% "scalatest" % "3.2.17" % Test,
      "org.apache.pekko" %% "pekko-http-testkit" % "1.2.0" % Test,
      "org.apache.pekko" %% "pekko-testkit" % "1.1.3" % Test
    )
  )
