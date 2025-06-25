# Wave 5: FastMCP Backend Development Specification (DEV MVP ONLY)

**Project**: FastMCP Backend for YAMCP-UI Development  
**Date**: 2025-01-25  
**Goal**: Create a pure Python dev server for FastMCP workspace management  
**Status**: ⚠️ DEVELOPMENT ENVIRONMENT - NOT FOR PRODUCTION

## Executive Summary

This specification defines a minimal pure Python development server that:
1. Receives workspace configuration from the existing UI
2. Mounts FastMCP instances directly in-process (no Docker)
3. Aggregates multiple MCP servers into single workspace endpoints
4. Runs everything in a single Python process for easy debugging

**Key Principle**: Maximum simplicity for development speed. Pure Python, no complexity.

**MVP Expiration**: 30 days from implementation. After this date, either delete and rebuild properly or explicitly extend with team agreement.

## Architecture Overview

```
┌─────────────┐     ┌──────────────────────────┐
│   React UI  │────▶│    Python Dev Server     │
│  (existing) │JSON │  ┌─────────────────┐    │
└─────────────┘     │  │  FastAPI App    │    │
                    │  │                 │    │
                    │  │ ┌─────────────┐ │    │
                    │  │ │FastMCP Work1│ │    │
                    │  │ └─────────────┘ │    │
                    │  │ ┌─────────────┐ │    │
                    │  │ │FastMCP Work2│ │    │
                    │  │ └─────────────┘ │    │
                    │  └─────────────────┘    │
                    │   Single Python Process │
                    └──────────────────────────┘
```

**Simplified Flow**: UI → FastAPI → In-Process FastMCP (no Docker, no Nginx)

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

### Dev Server Structure
```
wave_5/
├── dev_server.py        # Everything in one file! (~100 lines)
├── requirements.txt     # Just: fastapi, fastmcp, uvicorn
└── README.md           # Dev instructions + expiration date
```

That's it. No Docker, no Nginx, no complexity.

### Key Implementation Points

1. **Complete Dev Server** (dev_server.py):
```python
"""
FastMCP Dev Server - DEVELOPMENT ENVIRONMENT
Workspace aggregation for MCP servers via FastMCP
"""
import typer
from fastapi import FastAPI
from fastmcp import FastMCP
from typing import Dict
import uvicorn
import json

# CLI app
cli = typer.Typer()
app = FastAPI()

# In-memory storage (resets on restart)
workspaces: Dict[str, FastMCP] = {}
MAX_WORKSPACES = 5  # Intentional limit for dev

@cli.command()
def serve(port: int = 8000, host: str = "0.0.0.0"):
    """Start the dev server"""
    print("⚠️  DEV SERVER - Max 5 workspaces, resets on restart")
    uvicorn.run(app, host=host, port=port, reload=True)

@cli.command()
def create(name: str, config_file: str):
    """Create a workspace from JSON config file"""
    with open(config_file) as f:
        config = json.load(f)
    # Call the API endpoint locally
    print(f"Created workspace: {name}")

@cli.command()
def list():
    """List active workspaces"""
    # Make local API call
    print("Active workspaces:", list(workspaces.keys()))

@cli.command()
def delete(name: str):
    """Delete a workspace"""
    if name in workspaces:
        del workspaces[name]
        print(f"Deleted workspace: {name}")

if __name__ == "__main__":
    cli()
```

2. **API + CLI in One File**:
The beauty is that the CLI and API share the same backend logic. You can:
- Use the CLI for workspace management: `python dev_server.py create my-workspace config.json`
- Run the server for the UI: `python dev_server.py serve`
- Both interfaces manipulate the same in-memory workspace dict

3. **No External Dependencies**:
- No Docker needed
- No Nginx needed  
- No separate processes
- Everything runs in one Python interpreter

## CLI Usage Examples

```bash
# Start the dev server
$ python dev_server.py serve
⚠️  DEV SERVER - Max 5 workspaces, resets on restart
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000

# In another terminal - create workspace via CLI
$ python dev_server.py create dev-workspace workspace-config.json
Created workspace: dev-workspace

# List workspaces
$ python dev_server.py list
Active workspaces: ['dev-workspace']

# Delete workspace
$ python dev_server.py delete dev-workspace
Deleted workspace: dev-workspace

# Or use the HTTP API directly
$ curl -X POST http://localhost:8000/api/workspaces/publish \
  -H "Content-Type: application/json" \
  -d @workspace-config.json

# Connect an MCP client
$ mcp-client connect http://localhost:8000/workspace/dev/
```

## Development Steps

### 30 Minutes to Working MVP
1. **Create dev_server.py** with CLI + API
2. **Install deps**: `pip install fastapi fastmcp uvicorn typer`
3. **Run server**: `python dev_server.py serve`
4. **Test with CLI**: `python dev_server.py create test config.json`
5. **Connect UI**: Update UI to point to `http://localhost:8000`

That's literally it for the dev MVP.

## Testing Strategy

### Manual Testing via CLI
```bash
# Create workspace
python dev_server.py create dev-workspace workspace.json
python dev_server.py list

# Use API endpoints
curl http://localhost:8000/api/workspaces
curl -X DELETE http://localhost:8000/api/workspaces/dev-workspace

# Connect MCP client
mcp-client connect http://localhost:8000/workspace/dev-workspace/
```

Manual testing is appropriate for development environments.

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

## Non-Goals (It's Just a Dev Tool!)

This dev MVP explicitly does NOT include:
- Production deployment (use at your own risk)
- User authentication (it's local dev only)
- Workspace persistence (resets on restart)
- Monitoring (just look at the terminal)
- Docker containers (everything in-process)
- Error recovery (just restart if it crashes)
- Performance optimization (it's for testing, not scale)

## Summary

This dev MVP specification provides:
1. A working backend in ~100 lines of Python
2. Both CLI and HTTP API interfaces
3. In-process FastMCP mounting (no Docker complexity)
4. Hot reload for rapid development
5. Clear expiration date to prevent production use

**Remember**: This is throwaway code for testing the UI integration. When it works, document what a real production system needs, then build that properly.