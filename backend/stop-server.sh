#!/bin/bash

# Nitro Pricing Calculator - Backend Stop Script
# Gracefully stops the backend server

set -e

# Configuration
BACKEND_DIR="/Users/hyadav/code/personal/simple-price-calculator/backend"
PID_FILE="$BACKEND_DIR/server.pid"

echo "🛑 Stopping Nitro Pricing Calculator Backend..."

cd "$BACKEND_DIR"

if [ ! -f "$PID_FILE" ]; then
    echo "❌ No PID file found at $PID_FILE"
    echo "💡 Server may not be running or was started manually"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "❌ Process $PID is not running"
    rm -f "$PID_FILE"
    echo "🧹 Cleaned up stale PID file"
    exit 1
fi

echo "📋 Found server process: $PID"
echo "🔄 Sending TERM signal..."

kill -TERM "$PID"

# Wait for graceful shutdown
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Server stopped gracefully"
        rm -f "$PID_FILE"
        echo "🧹 Cleaned up PID file"
        exit 0
    fi
    echo "⏳ Waiting for shutdown... ($i/10)"
    sleep 1
done

echo "⚠️  Server didn't stop gracefully, forcing kill..."
kill -KILL "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "🔨 Server force-killed and PID file cleaned up"
