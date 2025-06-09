# Backend Server Management Scripts

This directory contains scripts to manage the Nitro Pricing Calculator backend server.

## Scripts

### 🔄 `./restart-server.sh`
**Restarts the backend server in background mode**
- Kills any existing backend processes (including port conflicts)
- Starts server in background with logging
- Creates PID file for process management
- Shows startup status and connection info

**Usage:**
```bash
./restart-server.sh
```

**Output:**
- Server logs: `server.log`
- Process ID: `server.pid`
- Server URL: http://localhost:8080

### 📊 `./status-server.sh`
**Shows detailed server status and health information**
- Process status and resource usage
- Connectivity check to server endpoints
- Recent log entries
- Management command help

**Usage:**
```bash
./status-server.sh
```

### 🛑 `./stop-server.sh`
**Gracefully stops the backend server**
- Sends TERM signal for graceful shutdown
- Waits up to 10 seconds for clean exit
- Force kills if necessary
- Cleans up PID file

**Usage:**
```bash
./stop-server.sh
```

## Quick Reference

| Task | Command |
|------|---------|
| Start/Restart Server | `./restart-server.sh` |
| Check Server Status | `./status-server.sh` |
| Stop Server | `./stop-server.sh` |
| View Live Logs | `tail -f server.log` |
| Manual Kill | `kill $(cat server.pid)` |

## Server Endpoints

When running, the server provides:
- **Health Check**: http://localhost:8080/api/health
- **Discovery**: http://localhost:8080/api/chargebee/discovery
- **Full API Documentation**: Available in project documentation

## Troubleshooting

### Server Won't Start
1. Check if port 8080 is in use: `lsof -i :8080`
2. Check logs: `tail -20 server.log`
3. Ensure `.env` file exists with proper Chargebee credentials

### Server Appears Stuck
1. Check status: `./status-server.sh`
2. Check if process is responding: `curl http://localhost:8080/api/health`
3. Force restart: `./restart-server.sh`

### Clean State Reset
```bash
./stop-server.sh
rm -f server.pid server.log
./restart-server.sh
```

## Log Management

The `server.log` file will grow over time. To manage:
```bash
# Archive current log
mv server.log server.log.$(date +%Y%m%d_%H%M%S)

# Restart with fresh log
./restart-server.sh
```

## Development Workflow

**Typical development cycle:**
1. Make code changes
2. `./restart-server.sh` - Apply changes
3. `./status-server.sh` - Verify running
4. Test endpoints
5. `tail -f server.log` - Monitor for issues
