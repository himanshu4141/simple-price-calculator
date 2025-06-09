#!/bin/bash

# Nitro Pricing Calculator - Backend Status Script
# Check if the backend server is running and show useful information

set -e

# Configuration
BACKEND_DIR="/Users/hyadav/code/personal/simple-price-calculator/backend"
LOG_FILE="$BACKEND_DIR/server.log"
PID_FILE="$BACKEND_DIR/server.pid"

echo "📊 Nitro Pricing Calculator Backend Status"
echo "=========================================="

cd "$BACKEND_DIR"

# Check PID file
if [ ! -f "$PID_FILE" ]; then
    echo "❌ Status: NOT RUNNING"
    echo "💡 No PID file found - server may not have been started with restart-server.sh"
    echo ""
    echo "🚀 To start: ./restart-server.sh"
    exit 1
fi

PID=$(cat "$PID_FILE")

# Check if process is actually running
if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "❌ Status: NOT RUNNING"
    echo "💡 PID file exists but process $PID is not running"
    echo "🧹 Consider running: rm $PID_FILE"
    echo ""
    echo "🚀 To start: ./restart-server.sh"
    exit 1
fi

# Server is running
echo "✅ Status: RUNNING"
echo "📋 PID: $PID"
echo "⏰ Started: $(ps -p $PID -o lstart= | xargs)"
echo "💾 Memory: $(ps -p $PID -o rss= | xargs)KB"
echo "⏱️  CPU Time: $(ps -p $PID -o time= | xargs)"

# Check if server is responding
echo ""
echo "🌐 Connectivity Check:"
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ Server responding at http://localhost:8080"
    
    # Try the discovery endpoint
    if curl -s http://localhost:8080/api/chargebee/discovery > /dev/null 2>&1; then
        echo "✅ Discovery endpoint responding"
        
        # Get item count
        ITEM_COUNT=$(curl -s http://localhost:8080/api/chargebee/discovery | jq -r '.items | length' 2>/dev/null || echo "unknown")
        PRICE_COUNT=$(curl -s http://localhost:8080/api/chargebee/discovery | jq -r '.itemPrices | length' 2>/dev/null || echo "unknown")
        
        if [ "$ITEM_COUNT" != "unknown" ] && [ "$PRICE_COUNT" != "unknown" ]; then
            echo "📦 Items: $ITEM_COUNT | Prices: $PRICE_COUNT"
        fi
    else
        echo "⚠️  Discovery endpoint not responding"
    fi
else
    echo "❌ Server not responding at http://localhost:8080"
    echo "💡 Server may still be starting up"
fi

# Show recent logs
echo ""
echo "📄 Recent Logs (last 10 lines):"
echo "--------------------------------"
if [ -f "$LOG_FILE" ]; then
    tail -n 10 "$LOG_FILE"
else
    echo "❌ No log file found at $LOG_FILE"
fi

echo ""
echo "🔧 Management Commands:"
echo "• View logs: tail -f $LOG_FILE"
echo "• Stop server: ./stop-server.sh"
echo "• Restart server: ./restart-server.sh"
echo "• Kill process: kill $PID"
