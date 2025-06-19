#!/bin/bash

# Nitro Pricing Calculator - Backend Restart Script
# Kills existing backend processes and starts server in background with logging

set -e

# Configuration
BACKEND_DIR="/Users/hyadav/code/personal/simple-price-calculator/backend"
LOG_FILE="$BACKEND_DIR/server.log"
PID_FILE="$BACKEND_DIR/server.pid"

echo "🔄 Restarting Nitro Pricing Calculator Backend..."

# Change to backend directory
cd "$BACKEND_DIR"

# Function to kill existing processes
kill_existing_processes() {
    echo "🔍 Checking for existing backend processes..."
    
    # Kill by PID file if it exists
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "📋 Found process with PID: $PID"
            kill -TERM "$PID" 2>/dev/null || true
            sleep 2
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "⚠️  Process still running, forcing kill..."
                kill -KILL "$PID" 2>/dev/null || true
            fi
            echo "✅ Killed process $PID"
        fi
        rm -f "$PID_FILE"
    fi
    
    # Check for processes using port 8080
    PORT_PIDS=$(lsof -ti :8080 2>/dev/null || true)
    if [ ! -z "$PORT_PIDS" ]; then
        echo "🌐 Found processes using port 8080: $PORT_PIDS"
        echo "$PORT_PIDS" | xargs kill -TERM 2>/dev/null || true
        sleep 3
        # Force kill if still running
        REMAINING_PIDS=$(lsof -ti :8080 2>/dev/null || true)
        if [ ! -z "$REMAINING_PIDS" ]; then
            echo "🔨 Force killing remaining processes: $REMAINING_PIDS"
            echo "$REMAINING_PIDS" | xargs kill -KILL 2>/dev/null || true
        fi
        echo "✅ Cleared port 8080"
    fi
    
    # Kill any sbt processes running in this directory
    RUNNING_PIDS=$(ps aux | grep "sbt.*run" | grep -v grep | grep "$BACKEND_DIR" | awk '{print $2}' || true)
    if [ ! -z "$RUNNING_PIDS" ]; then
        echo "🎯 Found running sbt processes: $RUNNING_PIDS"
        echo "$RUNNING_PIDS" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        # Force kill if still running
        echo "$RUNNING_PIDS" | xargs kill -KILL 2>/dev/null || true
        echo "✅ Killed sbt processes"
    fi
    
    # Kill any Java processes that might be related to our backend
    JAVA_PIDS=$(ps aux | grep java | grep -E "(nitro-price-calculator|NitroPricingApp)" | grep -v grep | awk '{print $2}' || true)
    if [ ! -z "$JAVA_PIDS" ]; then
        echo "☕ Found Java processes: $JAVA_PIDS"
        echo "$JAVA_PIDS" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        echo "$JAVA_PIDS" | xargs kill -KILL 2>/dev/null || true
        echo "✅ Killed Java processes"
    fi
    
    # Wait a moment for everything to clean up
    sleep 2
}

# Function to start the server
start_server() {
    echo "🚀 Starting server in background..."
    
    # Double-check port is available
    if lsof -i :8080 >/dev/null 2>&1; then
        echo "❌ Port 8080 is still in use. Please check:"
        lsof -i :8080
        exit 1
    fi
    
    # Create/truncate log file with timestamp
    echo "=== Nitro Pricing Calculator Backend Started at $(date) ===" > "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Start sbt run in background and capture PID
    nohup sbt run >> "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Save PID to file
    echo "$SERVER_PID" > "$PID_FILE"
    
    echo "📋 Server started with PID: $SERVER_PID"
    echo "📄 Logs being written to: $LOG_FILE"
    echo "🔧 PID file: $PID_FILE"
    
    # Wait a moment and check if process is still running
    sleep 5
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo "✅ Server is running successfully!"
        echo "🌐 Server should be available at: http://localhost:8080"
        echo "📊 Check status with: ./status-server.sh"
        echo "📄 Monitor logs with: tail -f $LOG_FILE"
    else
        echo "❌ Server failed to start. Check logs:"
        tail -n 20 "$LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Main execution
kill_existing_processes
start_server

echo ""
echo "🎉 Backend restart complete!"
echo "📋 PID: $(cat $PID_FILE)"
echo "📄 Log file: $LOG_FILE"
echo "🛑 To stop: kill \$(cat $PID_FILE) && rm $PID_FILE"
echo "📊 To monitor: tail -f $LOG_FILE"
