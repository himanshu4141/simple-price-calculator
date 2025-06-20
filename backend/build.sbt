ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "2.13.12"

lazy val root = (project in file("."))
  .settings(
    name := "nitro-price-calculator-api",
    libraryDependencies ++= Seq(
      // Pekko HTTP (with SLF4J exclusions to avoid conflicts)
      "org.apache.pekko" %% "pekko-http" % "1.2.0" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "org.apache.pekko" %% "pekko-stream" % "1.1.3" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "org.apache.pekko" %% "pekko-actor-typed" % "1.1.3" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "org.apache.pekko" %% "pekko-slf4j" % "1.1.3" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      
      // JSON support with Circe (with SLF4J exclusions)
      "io.circe" %% "circe-core" % "0.14.6",
      "io.circe" %% "circe-generic" % "0.14.6",
      "io.circe" %% "circe-parser" % "0.14.6",
      "org.mdedetrich" %% "pekko-http-circe" % "1.1.0" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      
      // Cats for functional programming
      "org.typelevel" %% "cats-core" % "2.10.0",
      "org.typelevel" %% "cats-effect" % "3.5.4",
      
      // HTTP client for external APIs (with SLF4J exclusions)
      "com.softwaremill.sttp.client3" %% "core" % "3.9.2" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "com.softwaremill.sttp.client3" %% "circe" % "3.9.2" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "com.softwaremill.sttp.client3" %% "async-http-client-backend-future" % "3.9.2" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      
      // Configuration
      "com.typesafe" % "config" % "1.4.3",
      "io.github.cdimascio" % "dotenv-java" % "3.0.0",
      
      // Stripe SDK (with SLF4J exclusions)
      "com.stripe" % "stripe-java" % "29.2.0" excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      
      // Avalara integration via REST API (using existing STTP client)
      // Configuration already in environment variables
      
      // Logging - Clean SLF4J 1.7.x setup
      "org.slf4j" % "slf4j-api" % "1.7.36",
      "ch.qos.logback" % "logback-classic" % "1.2.12",
      "com.typesafe.scala-logging" %% "scala-logging" % "3.9.5",
      
      // Testing (with SLF4J exclusions)
      "org.scalatest" %% "scalatest" % "3.2.17" % Test,
      "org.apache.pekko" %% "pekko-http-testkit" % "1.2.0" % Test excludeAll(
        ExclusionRule(organization = "org.slf4j")
      ),
      "org.apache.pekko" %% "pekko-testkit" % "1.1.3" % Test excludeAll(
        ExclusionRule(organization = "org.slf4j")
      )
    )
  )

// Assembly configuration
ThisBuild / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case PathList("reference.conf") => MergeStrategy.concat
  case PathList("application.conf") => MergeStrategy.concat
  case "logback.xml" => MergeStrategy.last
  case x if x.endsWith(".proto") => MergeStrategy.rename
  case x if x.endsWith(".class") => MergeStrategy.last
  case x if x.endsWith(".properties") => MergeStrategy.last
  case x if x.endsWith(".xml") => MergeStrategy.last
  case x if x.endsWith(".txt") => MergeStrategy.last
  case x if x.endsWith(".conf") => MergeStrategy.concat
  case x => MergeStrategy.first
}

assembly / assemblyJarName := "simple-price-calculator-assembly-0.1.0-SNAPSHOT.jar"
