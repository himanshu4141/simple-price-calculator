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

# Install envsubst and su-exec for environment variable substitution and user switching
RUN apk add --no-cache gettext su-exec

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built application from builder stage
COPY --from=builder /app/dist/simple-price-calculator /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 101 -S nginx || true

# Create necessary directories and set permissions
RUN mkdir -p /tmp /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chmod -R 755 /var/cache/nginx && \
    chmod -R 755 /var/log/nginx

# Don't switch to non-root user yet (need root for envsubst)
# USER nginx

# Expose port (Render will set PORT environment variable)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx with environment variable substitution
CMD ["/docker-entrypoint.sh"]