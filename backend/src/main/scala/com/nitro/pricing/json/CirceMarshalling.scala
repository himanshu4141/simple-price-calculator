package com.nitro.pricing.json

import org.apache.pekko.http.scaladsl.marshalling.{Marshaller, ToEntityMarshaller}
import org.apache.pekko.http.scaladsl.unmarshalling.{FromEntityUnmarshaller, Unmarshaller}
import org.apache.pekko.http.scaladsl.model.{ContentTypes, HttpEntity, MediaTypes}
import org.apache.pekko.http.scaladsl.model.headers.`Content-Type`
import io.circe.{Encoder, Decoder, Json, Printer}
import io.circe.parser._
import scala.concurrent.Future

/**
 * Custom Circe marshalling support for Pekko-HTTP
 * This provides the missing pekko-http-circe functionality
 */
trait CirceMarshalling {

  private val jsonContentType = ContentTypes.`application/json`
  private val printer = Printer.noSpaces.copy(dropNullValues = true)

  implicit def circeToEntityMarshaller[A](implicit encoder: Encoder[A]): ToEntityMarshaller[A] = {
    Marshaller.withFixedContentType(jsonContentType) { value =>
      HttpEntity(jsonContentType, printer.print(encoder(value)))
    }
  }

  implicit def circeFromEntityUnmarshaller[A](implicit decoder: Decoder[A]): FromEntityUnmarshaller[A] = {
    Unmarshaller.stringUnmarshaller
      .forContentTypes(jsonContentType)
      .flatMap { _ => _ => json =>
        decode[A](json) match {
          case Right(value) => Future.successful(value)
          case Left(error) => Future.failed(error)
        }
      }
  }

  // Support for raw Json objects
  implicit val jsonMarshaller: ToEntityMarshaller[Json] = circeToEntityMarshaller[Json]
  implicit val jsonUnmarshaller: FromEntityUnmarshaller[Json] = circeFromEntityUnmarshaller[Json]
}

object CirceMarshalling extends CirceMarshalling
