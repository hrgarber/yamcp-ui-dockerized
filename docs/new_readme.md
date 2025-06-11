# YAMCP-UI MCP Hub (Dockerized)

A containerized Model Context Protocol (MCP) Hub that provides a web interface for managing MCP servers and workspaces, with Server-Sent Events (SSE) endpoints for real-time MCP server access.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/yamcp-ui-dockerized.git
cd yamcp-ui-dockerized

# Start the MCP Hub
docker-compose up -d

# Access the web interface
open http://localhost:5173
```

## 🎯 What This Does

This project transforms the yamcp-ui into a **complete MCP Hub** that:

1. **Manages MCP Servers**: Add, configure, and organize MCP servers through a web UI
2. **Creates Workspaces**: Group MCP servers into logical workspaces
3. **Provides SSE Access**: Stream MCP server output via Server-Sent Events at `/mcp/:workspaceName`
4. **Hot Reloading**: Automatically restarts when configurations change
5. **Self-Healing**: PM2 manages processes with automatic restarts

## 🏗️ Architecture

```
Web UI (React) ←→ Express API ←→ PM2 ←→ Server.mjs ←→ SSE Endpoints ←→ MCP Servers
     ↓                ↓                     ↓              ↓
   Port 5173       Port 8765           File Watching    Process Management
```

### Key Components

- **Frontend**: React-based yamcp-ui for configuration management
- **Backend**: Express.js server with SSE endpoints (`server.mjs`)
- **Process Manager**: PM2 for reliability and hot reloading
- **Container**: Alpine Linux with Node.js, Python, and yamcp
- **Storage**: Persistent volumes for configuration data

## 📡 SSE Endpoints

### Connect to MCP Workspace
```
GET /mcp/:workspaceName
Content-Type: text/event-stream
```

**Example Usage:**
```bash
curl -N http://localhost:8765/mcp/my-workspace
```

**Response Format:**
```
event: info
data: {"message": "Attempting to start workspace: my-workspace"}

data: [MCP server output line 1]
data: [MCP server output line 2]

event: close
data: {"message": "Workspace my-workspace connection closed. Exit code: 0"}
```

### Event Types
- `info`: System messages (startup, shutdown)
- `error`: Error messages from MCP processes
- `close`: Process termination notification
- Default: Raw MCP server output

## 🔧 Configuration

### Server Configuration
Add MCP servers via the web UI or API:

```json
{
  "name": "my-server",
  "type": "stdio", 
  "command": "python3",
  "args": ["/path/to/server.py"],
  "env": {}
}
```

### Workspace Configuration
Create workspaces to group servers:

```json
{
  "name": "my-workspace",
  "servers": ["server1", "server2"]
}
```

### Environment Variables
- `PORT`: Backend port (default: 8765)
- `NODE_ENV`: Environment mode (development/production)

## 🐳 Docker Details

### Ports
- `5173`: Frontend (Vite development server)
- `8765`: Backend API + SSE endpoints

### Volumes
- `yamcp-ui-data:/root/.local/share/yamcp-nodejs`: Persistent configuration storage

### Services
- `yamcp-ui`: Main application container

## 🧪 Testing

### Full E2E Test Suite
```bash
./test-docker-e2e.sh
```

Tests include:
- Container lifecycle
- Service health checks
- Configuration management
- SSE functionality
- Hot reloading
- Error handling
- Container resilience

### Manual Testing
```bash
# Test API endpoints
curl http://localhost:8765/api/stats
curl http://localhost:8765/api/workspaces

# Test SSE streaming
curl -N http://localhost:8765/mcp/your-workspace-name

# Check PM2 status
docker exec yamcp-ui-dev pm2 list
```

## 🔄 Hot Reloading

The system automatically reloads when configuration files change:

1. User modifies configuration via web UI
2. PM2 detects file changes in `/root/.local/share/yamcp-nodejs/`
3. PM2 gracefully restarts `server.mjs`
4. Active SSE connections are dropped (clients should reconnect)
5. New configuration is loaded

**Watched Files:**
- `providers.json` (MCP server configurations)
- `workspaces.json` (workspace definitions)

## ⚡ Process Management

### PM2 Configuration
- **Process Name**: `yamcp-ui-backend-hub`
- **Instances**: 1
- **Auto Restart**: Yes
- **Max Restarts**: 5 with exponential backoff
- **Memory Limit**: 500MB

### Graceful Shutdown
The system properly cleans up:
1. Active MCP processes are terminated (SIGTERM)
2. SSE connections are closed
3. PM2 manages main process lifecycle

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Start backend only
npm start
```

### Adding MCP Servers
1. Use the web UI at `http://localhost:5173`
2. Or use the API:
   ```bash
   curl -X POST http://localhost:8765/api/servers \
     -H "Content-Type: application/json" \
     -d '{"name":"test","type":"stdio","command":"echo","args":["hello"]}'
   ```

### Debugging
```bash
# View container logs
docker-compose logs -f yamcp-ui

# View PM2 logs
docker exec yamcp-ui-dev pm2 logs

# Execute commands in container
docker exec -it yamcp-ui-dev sh
```

## 🔒 Security Considerations

- API access restricted to same-origin requests
- No authentication implemented (intended for local development)
- Container runs with standard security practices
- No sensitive data in container environment

## 🚧 Known Limitations

1. **yamcp CLI Issues**: Direct MCP server execution used as workaround
2. **SSE Connection Drops**: Connections close on hot reload (by design)
3. **Single Server per Workspace**: Currently only first server in workspace is executed
4. **stdio Only**: Only stdio-type MCP servers supported currently

## 📚 Troubleshooting

### Common Issues

**Container won't start:**
```bash
docker-compose logs yamcp-ui
docker-compose build --no-cache
```

**API not accessible:**
- Check port 8765 is not in use
- Verify container is running: `docker-compose ps`

**SSE endpoint fails:**
- Ensure workspace exists in configuration
- Check server configuration is valid
- Verify MCP server executable is available in container

**Hot reloading not working:**
- Check PM2 file watching: `docker exec yamcp-ui-dev pm2 logs`
- Verify file paths in `ecosystem.config.cjs`

### Logs and Debugging
```bash
# Full container logs
docker-compose logs yamcp-ui

# PM2 process logs
docker exec yamcp-ui-dev pm2 logs yamcp-ui-backend-hub

# Check running processes
docker exec yamcp-ui-dev ps aux
```

## 🤝 Contributing

1. Create feature branch from `main`
2. Make changes and test with `./test-docker-e2e.sh`
3. Commit with descriptive messages
4. Submit pull request

## 📄 License

This project maintains the same license as the original yamcp-ui project.