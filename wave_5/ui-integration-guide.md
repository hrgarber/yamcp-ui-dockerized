# UI Integration Guide: Connecting YAMCP UI to FastMCP Backend

## Overview

The existing YAMCP UI doesn't need to change at all. We'll create a FastAPI backend that:
1. Exposes the same API endpoints the UI expects
2. Manages Docker containers running FastMCP
3. Uses ASGI mounting to integrate everything

## Architecture

```
┌─────────────┐
│  React UI   │
│ (port 3000) │
└──────┬──────┘
       │ API calls
       ▼
┌─────────────────────┐
│  FastAPI Backend    │
│    (port 8000)      │
│ ┌─────────────────┐ │
│ │ /api/* routes   │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ /workspace/*    │ │ ← Mounted FastMCP apps
│ │ (ASGI mounted)  │ │
│ └─────────────────┘ │
└─────────────────────┘
```

## Integration Approach

### Option 1: Direct ASGI Mounting (Recommended)

Instead of spinning up separate Docker containers, we can mount FastMCP instances directly in our FastAPI app:

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.applications import Starlette
from starlette.routing import Mount
from fastmcp import FastMCP
import json

app = FastAPI()

# Add CORS for UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active workspaces
workspaces = {}

@app.post("/api/workspaces/publish")
async def publish_workspace(config: WorkspaceConfig):
    """Create a new workspace"""
    name = config.name
    
    # Create FastMCP instance for this workspace
    mcp = FastMCP(f"Workspace-{name}")
    
    # Mount each configured server
    for server_name, server_config in config.servers.items():
        # Here we'd mount actual MCP servers
        # For now, let's add a demo tool
        @mcp.tool(name=f"{server_name}_demo")
        def demo_tool(input: str) -> str:
            return f"Hello from {server_name}: {input}"
    
    # Create ASGI app with custom path
    workspace_app = mcp.streamable_http_app(
        path=f"/workspace/{name}/",
        middleware=[
            # Add any custom middleware here
        ]
    )
    
    # Mount it to our main app
    app.mount(f"/workspace/{name}", workspace_app)
    
    # Store reference
    workspaces[name] = {
        "mcp": mcp,
        "app": workspace_app,
        "config": config
    }
    
    return WorkspaceStatus(
        name=name,
        path=f"/workspace/{name}/",
        status="running",
        health="healthy",
        container_id=None  # No container in this approach
    )

@app.get("/api/workspaces")
async def list_workspaces():
    """List all workspaces"""
    return {
        "workspaces": [
            WorkspaceStatus(
                name=name,
                path=f"/workspace/{name}/",
                status="running",
                health="healthy",
                container_id=None
            )
            for name in workspaces.keys()
        ]
    }

@app.delete("/api/workspaces/{name}")
async def delete_workspace(name: str):
    """Delete a workspace"""
    if name in workspaces:
        # In production, we'd need to properly unmount
        del workspaces[name]
        return {"success": True, "message": "Workspace deleted"}
    return {"success": False, "message": "Workspace not found"}
```

### Option 2: Hybrid Approach (Docker + Proxy)

If you need true isolation with Docker containers, use a reverse proxy:

```python
# backend/main.py with Docker approach
from httpx import AsyncClient

@app.post("/api/workspaces/publish")
async def publish_workspace(config: WorkspaceConfig):
    """Create workspace in Docker"""
    container = docker_manager.create_workspace(config)
    
    # Wait for container to be ready
    await wait_for_container(container.id)
    
    return WorkspaceStatus(
        name=config.name,
        path=f"/workspace/{config.name}/",
        status="running",
        health="healthy",
        container_id=container.id
    )

# Proxy requests to containers
@app.api_route("/workspace/{name}/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_workspace(name: str, path: str, request: Request):
    """Proxy requests to workspace containers"""
    container_port = get_container_port(name)
    
    async with AsyncClient() as client:
        # Forward the request
        response = await client.request(
            method=request.method,
            url=f"http://workspace-{name}:{container_port}/{path}",
            headers=dict(request.headers),
            content=await request.body()
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
```

## UI Configuration

The UI only needs to know the backend URL. Update the API client:

```javascript
// src/api/client.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const api = {
  // Existing endpoints work as-is
  listWorkspaces: () => fetch(`${API_BASE}/api/workspaces`),
  publishWorkspace: (config) => fetch(`${API_BASE}/api/workspaces/publish`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config)
  }),
  
  // MCP client connects to workspace path
  connectToWorkspace: (name) => {
    return `${API_BASE}/workspace/${name}/mcp/`
  }
}
```

## Development Setup

### 1. Run Backend
```bash
cd wave_5/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Run UI (existing)
```bash
cd ..  # back to project root
npm install
npm start  # runs on port 3000
```

### 3. Environment Variables
Create `.env` in the UI directory:
```
REACT_APP_API_URL=http://localhost:8000
```

## Middleware Benefits

With FastMCP's ASGI integration, we get:

1. **CORS Handling**: Built into FastAPI
2. **Path Mounting**: Clean workspace URLs
3. **Request Routing**: Automatic routing to workspaces
4. **No Port Management**: Everything on one port
5. **Easy Authentication**: Can add auth middleware later

## Production Considerations

For production deployment with Docker Compose:

```yaml
version: '3.8'

services:
  # Single service running everything
  app:
    build: ./wave_5
    ports:
      - "8000:8000"
    environment:
      - UI_URL=http://localhost:3000
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # If using Docker approach
  
  ui:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
```

## Summary

The integration is surprisingly simple:
1. **UI**: No changes needed, just point to backend URL
2. **Backend**: FastAPI with mounted FastMCP instances
3. **Middleware**: Handles CORS, routing, and future auth
4. **Single Port**: Backend on 8000, UI on 3000 (or combine with nginx)

This approach leverages FastMCP's ASGI integration to create a clean, maintainable solution without the complexity of managing separate containers for each workspace.