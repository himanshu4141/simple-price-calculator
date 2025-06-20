# Multi-stage Docker build for Angular frontend
# Stage 1: Build stage with Node.js
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (use npm install as fallback for Docker build)
RUN npm install --frozen-lockfile

# Copy source code
COPY . .

# Build the Angular application for production
RUN npm run build -- --configuration=production

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built application from builder stage
COPY --from=builder /app/dist/simple-price-calculator /usr/share/nginx/html

# Create necessary directories and set permissions for container environment
RUN mkdir -p /tmp /var/cache/nginx && \
    chmod -R 755 /var/cache/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose port (Render will set PORT environment variable)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx with environment variable substitution
CMD ["/docker-entrypoint.sh"]