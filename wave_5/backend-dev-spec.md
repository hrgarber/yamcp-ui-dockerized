# Wave 5: FastMCP Backend Development Specification

**Project**: FastMCP Backend for YAMCP-UI  
**Date**: 2025-01-25  
**Goal**: Replace broken YAMCP with a minimal Python backend using FastMCP

## Executive Summary

This specification defines a minimal Python backend that:
1. Receives workspace configuration from the existing UI
2. Spins up Docker containers running FastMCP
3. Aggregates multiple MCP servers into single workspace endpoints
4. Exposes workspaces via path-based routing on a single port

**Key Principle**: Keep it dead simple. The UI builds JSON, the backend passes it to FastMCP, FastMCP does all the work.

## Architecture Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   React UI  │────▶│  Python Backend │────▶│ FastMCP Container│
│  (existing) │JSON │    (FastAPI)    │Docker│   (Workspace)    │
└─────────────┘     └─────────────────┘     └──────────────────┘
                            │                         │
                            ▼                         ▼
                    ┌─────────────┐          ┌────────────┐
                    │    Nginx    │          │ MCP Servers│
                    │   Routing   │          │  (github,  │
                    └─────────────┘          │filesystem) │
                                             └────────────┘
```

## Core Data Types

### 1. WorkspaceConfig (Input from UI)
```python
from typing import Dict, List
from pydantic import BaseModel

class ServerConfig(BaseModel):
    command: str
    args: List[str]

class WorkspaceConfig(BaseModel):
    name: str
    servers: Dict[str, ServerConfig]
    
# Example:
{
    "name": "dev-workspace",
    "servers": {
        "github": {
            "command": "mcp-server-github",
            "args": ["--token", "${GITHUB_TOKEN}"]
        },
        "filesystem": {
            "command": "mcp-server-filesystem", 
            "args": ["--root", "/data"]
        }
    }
}
```

### 2. WorkspaceStatus (Output to UI)
```python
class WorkspaceStatus(BaseModel):
    name: str
    path: str  # e.g., "/workspace/dev/"
    status: str  # "running", "starting", "stopped", "error"
    health: str  # "healthy", "unhealthy"
    container_id: str | None
    
# Example:
{
    "name": "dev-workspace",
    "path": "/workspace/dev/",
    "status": "running",
    "health": "healthy",
    "container_id": "abc123..."
}
```

## API Endpoints

### 1. Publish/Create Workspace
```http
POST /api/workspaces/publish
Content-Type: application/json

Body: WorkspaceConfig

Response: WorkspaceStatus
```

### 2. List Workspaces
```http
GET /api/workspaces

Response: {
    "workspaces": [WorkspaceStatus, ...]
}
```

### 3. Delete Workspace
```http
DELETE /api/workspaces/{name}

Response: {
    "success": true,
    "message": "Workspace deleted"
}
```

### 4. Get Workspace Status
```http
GET /api/workspaces/{name}

Response: WorkspaceStatus
```

## Implementation Details

### Backend Structure
```
wave_5/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── models.py         # Pydantic models
│   ├── docker_manager.py # Docker container management
│   └── requirements.txt  # Python dependencies
├── workspace/
│   ├── Dockerfile        # FastMCP container image
│   ├── entrypoint.py     # FastMCP aggregation script
│   └── requirements.txt  # FastMCP + MCP servers
├── nginx/
│   └── nginx.conf        # Path-based routing
└── docker-compose.yml    # Orchestration
```

### Key Implementation Points

1. **Docker Container Management** (docker_manager.py):
```python
import docker
from typing import Dict

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
        self.network_name = "yamcp-network"
    
    def create_workspace(self, config: WorkspaceConfig) -> str:
        # Create container with FastMCP
        # Pass config as environment variable
        # Return container ID
        pass
    
    def delete_workspace(self, name: str):
        # Stop and remove container
        pass
    
    def get_workspace_status(self, name: str) -> Dict:
        # Check container status
        pass
```

2. **FastMCP Workspace Script** (entrypoint.py):
```python
import os
import json
from fastmcp import FastMCP

# Read config from environment
config = json.loads(os.environ['WORKSPACE_CONFIG'])
workspace_name = config['name']

# Create FastMCP hub
mcp = FastMCP(f"Workspace-{workspace_name}")

# Mount each server
for server_name, server_config in config['servers'].items():
    # Create and mount MCP server instances
    # FastMCP handles the aggregation
    pass

# Run with SSE transport on workspace path
if __name__ == "__main__":
    mcp.run(
        transport="sse",
        host="0.0.0.0",
        port=8000,
        path=f"/workspace/{workspace_name}/"
    )
```

3. **Nginx Configuration**:
```nginx
server {
    listen 3000;
    
    # UI
    location / {
        proxy_pass http://ui:3000;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8000;
    }
    
    # Workspace routing
    location ~ ^/workspace/([^/]+)/ {
        set $workspace_name $1;
        proxy_pass http://workspace-$workspace_name:8000;
        
        # SSE specific headers
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

## Docker Compose Structure

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "3000:3000"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    networks:
      - yamcp-network

  ui:
    # Existing React UI
    build: ../
    networks:
      - yamcp-network

  backend:
    build: ./backend
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - yamcp-network

networks:
  yamcp-network:
    name: yamcp-network
    driver: bridge
```

## Development Steps

### Phase 1: Basic Backend (Day 1)
1. Set up FastAPI project structure
2. Create Pydantic models
3. Implement Docker container creation
4. Test container lifecycle

### Phase 2: FastMCP Integration (Day 2)
1. Create FastMCP workspace Dockerfile
2. Write aggregation entrypoint script
3. Test multi-server mounting
4. Verify SSE endpoint works

### Phase 3: Integration (Day 3)
1. Set up Nginx routing
2. Connect to existing UI
3. End-to-end testing
4. Documentation

## Testing Strategy

### Unit Tests
- Docker manager functions
- API endpoint validation
- Config parsing

### Integration Tests
- Container creation/deletion
- SSE connection to workspaces
- Multi-server aggregation

### End-to-End Tests
- UI → Backend → FastMCP flow
- Path-based routing
- Error handling

## Success Criteria

1. **Functionality**:
   - [ ] UI can create workspaces without modification
   - [ ] Multiple MCP servers aggregate into one endpoint
   - [ ] Path-based routing works (e.g., `/workspace/dev/`)
   - [ ] Containers start/stop cleanly

2. **Simplicity**:
   - [ ] Backend under 300 lines of code
   - [ ] No database required
   - [ ] No complex state management
   - [ ] Clear separation of concerns

3. **Performance**:
   - [ ] Container startup < 5 seconds
   - [ ] Support 10+ concurrent workspaces
   - [ ] Minimal resource usage

## Non-Goals

This implementation explicitly does NOT include:
- User authentication
- Workspace persistence
- Complex monitoring
- Configuration history
- Multi-node deployment
- Backup/restore

## Summary

This specification provides a minimal, focused solution that:
1. Reuses the existing UI completely
2. Replaces YAMCP with FastMCP aggregation
3. Uses simple pass-through architecture
4. Leverages Docker for isolation
5. Provides path-based routing on a single port

The entire backend should be implementable in ~200-300 lines of Python code, making it easy to understand, maintain, and extend.