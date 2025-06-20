# Multi-stage Docker build for Scala backend
# Stage 1: Build stage with SBT and Scala  
FROM eclipse-temurin:21-jdk AS builder

# Install necessary tools
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install SBT
RUN curl -L -o sbt.deb https://repo.scala-sbt.org/scalasbt/debian/sbt-1.9.7.deb && \
    dpkg -i sbt.deb && \
    rm sbt.deb

# Set working directory
WORKDIR /app

# Copy build configuration
COPY build.sbt .
COPY project/ project/

# Download dependencies (this layer will be cached if build.sbt doesn't change)
RUN sbt update

# Copy source code
COPY src/ src/

# Build the application
RUN sbt clean assembly

# Stage 2: Runtime stage with minimal JRE
FROM eclipse-temurin:21-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && adduser -S -u 1001 -G appuser appuser

# Set working directory
WORKDIR /app

# Copy the assembled JAR from builder stage
COPY --from=builder /app/target/scala-2.13/simple-price-calculator-assembly-*.jar app.jar

# Change ownership to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Expose port (Render will set PORT environment variable)
EXPOSE 8080

# Environment variables for production
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC"
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start the application
CMD java ${JAVA_OPTS} -Dhttp.port=${PORT} -jar app.jar