#!/bin/sh

# Auto-detect if this is a PR preview and construct backend URL accordingly
if [ -n "$RENDER_SERVICE_NAME" ]; then
    # Extract PR number if this is a preview service
    if echo "$RENDER_SERVICE_NAME" | grep -q "pr-"; then
        # This is a PR preview, construct corresponding backend URL
        PR_SUFFIX=$(echo "$RENDER_SERVICE_NAME" | sed 's/nitro-price-calculator//')
        BACKEND_URL="nitro-price-calculator-api${PR_SUFFIX}.onrender.com"
        BACKEND_HOST="nitro-price-calculator-api${PR_SUFFIX}.onrender.com"
        echo "PR Preview detected: Frontend=$RENDER_SERVICE_NAME, Backend=$BACKEND_URL"
    else
        # This is production
        BACKEND_URL="nitro-price-calculator-api.onrender.com"
        BACKEND_HOST="nitro-price-calculator-api.onrender.com"
        echo "Production deployment detected"
    fi
else
    # Fallback to environment variables or defaults
    BACKEND_URL=${BACKEND_URL:-"nitro-price-calculator-api.onrender.com"}
    BACKEND_HOST=${BACKEND_HOST:-"nitro-price-calculator-api.onrender.com"}
    echo "Using fallback backend configuration"
fi

echo "Starting nginx with backend: ${BACKEND_URL}"

# Substitute environment variables in nginx config
envsubst '${BACKEND_URL} ${BACKEND_HOST}' < /etc/nginx/nginx.conf > /tmp/nginx.conf && \
mv /tmp/nginx.conf /etc/nginx/nginx.conf

# Ensure proper permissions
chown nginx:nginx /etc/nginx/nginx.conf

# Start nginx as nginx user
exec su-exec nginx nginx -g "daemon off;"
