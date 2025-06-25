#!/usr/bin/env python3
"""
FastMCP Dev Server - DEVELOPMENT ENVIRONMENT
Workspace aggregation for MCP servers via FastMCP
"""
import typer
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from fastmcp import FastMCP
import uvicorn
import json

# CLI app
cli = typer.Typer()

# FastAPI app
app = FastAPI(title="FastMCP Dev Server")

# Enable CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:53155", "http://localhost:57987"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ServerConfig(BaseModel):
    command: str
    args: List[str]

class WorkspaceConfig(BaseModel):
    name: str
    servers: Optional[Dict[str, ServerConfig]] = None
    mcpServers: Optional[Dict[str, Dict]] = None  # Legacy format

# In-memory storage (resets on restart)
workspaces: Dict[str, FastMCP] = {}
MAX_WORKSPACES = 5

# API Endpoints
@app.post("/api/workspaces/{name}")
async def create_workspace(name: str, config: WorkspaceConfig):
    """Create or update workspace"""
    if len(workspaces) >= MAX_WORKSPACES and name not in workspaces:
        raise HTTPException(400, f"Max {MAX_WORKSPACES} workspaces (dev limit)")
    
    # Create FastMCP instance
    mcp = FastMCP(f"Workspace-{name}")
    
    # Mount MCP servers from config
    servers = config.servers or config.mcpServers or {}
    for server_name, server_config in servers.items():
        # TODO: Mount real MCP servers here
        # For now, create workspace-specific tools
        @mcp.tool(name=f"{server_name}_info")
        def server_info() -> str:
            return f"Server {server_name} in workspace {name}"
    
    # Mount the FastMCP app
    workspace_app = mcp.http_app()
    app.mount(f"/workspace/{name}", workspace_app)
    
    workspaces[name] = mcp
    
    return {
        "success": True,
        "workspace": {
            "name": name,
            "status": "running",
            "url": f"http://localhost:8000/workspace/{name}/mcp/v1",
            "health": {"status": "healthy"}
        }
    }

@app.get("/api/workspaces")
async def list_workspaces():
    """List all workspaces"""
    return {
        "workspaces": {
            name: {
                "config": {"name": name},
                "status": "running",
                "port": 8000,
                "url": f"http://localhost:8000/workspace/{name}/mcp/v1",
                "health": {"status": "healthy"}
            }
            for name in workspaces.keys()
        }
    }

@app.delete("/api/workspaces/{name}")
async def delete_workspace(name: str):
    """Delete workspace"""
    if name in workspaces:
        del workspaces[name]
        # Note: In production, would need to properly unmount
        return {"success": True}
    raise HTTPException(404, "Workspace not found")

@app.get("/api/stats")
async def get_stats():
    """Dashboard stats"""
    return {
        "totalServers": 0,  # Not tracking in dev
        "activeServers": 0,
        "totalWorkspaces": len(workspaces),
        "activeWorkspaces": len(workspaces)
    }

# CLI Commands
@cli.command()
def serve(port: int = 8000, host: str = "0.0.0.0"):
    """Start the dev server"""
    print(f"⚠️  DEV SERVER - Max {MAX_WORKSPACES} workspaces, resets on restart")
    print(f"🌐 API: http://{host}:{port}")
    print(f"📝 Docs: http://{host}:{port}/docs")
    uvicorn.run("dev_server:app", host=host, port=port, reload=True)

@cli.command()
def create(name: str, config_file: str = None):
    """Create workspace via CLI"""
    if config_file:
        with open(config_file) as f:
            config = json.load(f)
    else:
        config = {"name": name, "servers": {}}
    
    # In a real implementation, would make HTTP call to running server
    print(f"Workspace '{name}' created (start server first with 'serve' command)")

@cli.command()
def list():
    """List workspaces"""
    print(f"Active workspaces: {list(workspaces.keys())}")
    print("(Note: Only shows workspaces from current process)")

if __name__ == "__main__":
    cli()