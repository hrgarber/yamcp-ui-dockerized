#!/usr/bin/env python3
"""
FastMCP Aggregator for MCP Workspace
Aggregates multiple MCP servers into a single SSE endpoint
"""

import asyncio
import json
import os
import sys
from typing import Dict, List, Any, Optional
import structlog
from fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.responses import StreamingResponse, JSONResponse
from starlette.routing import Route, Mount
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from sse_starlette import EventSourceResponse
import uvicorn
import subprocess
import signal

# Configure structured logging
logger = structlog.get_logger()

class MCPAggregator:
    """Manages FastMCP hub and server aggregation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.workspace_name = config['workspace']['name']
        self.servers = config['workspace']['servers']
        # FastMCP application instance
        self.mcp = FastMCP(self.workspace_name)
        self.server_processes: Dict[str, subprocess.Popen] = {}
        self.mounted_servers: List[str] = []
        
    async def initialize(self) -> None:
        """Initialize the aggregator and mount servers"""
        logger.info("initializing_aggregator", workspace=self.workspace_name)
        
        # Mount each server based on configuration
        for server_config in self.servers:
            try:
                await self._mount_server(server_config)
            except Exception as e:
                logger.error("server_mount_failed", 
                           server=server_config['name'],
                           error=str(e))
                # Continue with other servers even if one fails
                
    async def _mount_server(self, server_config: Dict[str, Any]) -> None:
        """Mount a single MCP server"""
        server_name = server_config['name']
        command = server_config['command']
        args = server_config.get('args', [])
        env = server_config.get('env', {})
        workdir = server_config.get('workdir')
        
        logger.info("mounting_server", server=server_name, command=command)
        
        # Prepare environment variables
        server_env = os.environ.copy()
        
        # Substitute environment variables in args
        processed_args = []
        for arg in args:
            if arg.startswith('${') and arg.endswith('}'):
                env_var = arg[2:-1]
                value = os.environ.get(env_var, '')
                if not value:
                    logger.warning("missing_env_var", var=env_var, server=server_name)
                processed_args.append(value)
            else:
                processed_args.append(arg)
        
        # Add custom environment variables
        server_env.update(env)
        
        # Build full command
        full_command = [command] + processed_args
        
        try:
            # Start the server process
            process = subprocess.Popen(
                full_command,
                env=server_env,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Store process reference
            self.server_processes[server_name] = process
            
            # Give server time to start
            await asyncio.sleep(2)
            
            # Check if process is still running
            if process.poll() is not None:
                stderr = process.stderr.read().decode() if process.stderr else ''
                raise RuntimeError(f"Server process exited immediately: {stderr}")
            
            # Mount the server with FastMCP
            # FastMCP mount expects the server to be accessible via stdio
            try:
                # Create a context for the server with proper prefix
                server_context = {
                    "prefix": server_name,
                    "command": full_command,
                    "env": server_env
                }
                
                # Mount server using FastMCP's mount method
                # This will handle the stdio communication with the MCP server
                self.mcp.mount(f"mcp-server-{server_name}", full_command)
                self.mounted_servers.append(server_name)
                
            except Exception as mount_error:
                logger.error("mount_failed", server=server_name, error=str(mount_error))
                # Kill the process if mount fails
                process.terminate()
                raise mount_error
            
            logger.info("server_mounted", server=server_name)
            
        except Exception as e:
            logger.error("server_start_failed", 
                       server=server_name,
                       command=full_command,
                       error=str(e))
            raise
            
    async def shutdown(self) -> None:
        """Shutdown all server processes"""
        logger.info("shutting_down_aggregator")
        
        # Terminate all server processes
        for server_name, process in self.server_processes.items():
            try:
                process.terminate()
                # Give it time to terminate gracefully
                await asyncio.sleep(1)
                if process.poll() is None:
                    process.kill()
                logger.info("server_terminated", server=server_name)
            except Exception as e:
                logger.error("server_termination_failed", 
                           server=server_name,
                           error=str(e))
                
    def get_status(self) -> Dict[str, Any]:
        """Get current aggregator status"""
        running_servers = []
        failed_servers = []
        
        for server_name, process in self.server_processes.items():
            if process.poll() is None:
                running_servers.append(server_name)
            else:
                failed_servers.append(server_name)
                
        return {
            "workspace": self.workspace_name,
            "mounted_servers": self.mounted_servers,
            "running_servers": running_servers,
            "failed_servers": failed_servers,
            "total_servers": len(self.servers)
        }


# Global aggregator instance
aggregator: Optional[MCPAggregator] = None

async def sse_endpoint(request):
    """SSE endpoint for MCP protocol"""
    if not aggregator:
        return JSONResponse(
            {"error": "Aggregator not initialized"},
            status_code=500
        )
    
    # FastMCP handles the SSE protocol for MCP
    # Get the request body if it's a POST request
    if request.method == "POST":
        try:
            body = await request.body()
            # FastMCP will handle the MCP protocol messages
            # For now, we'll create a basic SSE response
            async def event_generator():
                """Generate SSE events for MCP protocol"""
                try:
                    # Send initial capabilities event
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "jsonrpc": "2.0",
                            "id": 1,
                            "result": {
                                "protocolVersion": "1.0",
                                "capabilities": {
                                    "tools": {},
                                    "resources": {},
                                    "prompts": {}
                                },
                                "serverInfo": {
                                    "name": aggregator.workspace_name,
                                    "version": "1.0.0"
                                }
                            }
                        })
                    }
                    
                    # Keep connection alive
                    while True:
                        await asyncio.sleep(30)
                        yield {
                            "event": "ping",
                            "data": json.dumps({"timestamp": asyncio.get_event_loop().time()})
                        }
                        
                except asyncio.CancelledError:
                    logger.info("sse_connection_closed")
                    raise
            
            return EventSourceResponse(event_generator())
            
        except Exception as e:
            logger.error("sse_request_error", error=str(e))
            return JSONResponse({"error": str(e)}, status_code=400)
    
    # For GET requests, return SSE stream
    async def event_generator():
        """Generate SSE events for MCP protocol"""
        try:
            # Send connection established event
            yield {
                "event": "open",
                "data": json.dumps({
                    "workspace": aggregator.workspace_name,
                    "servers": aggregator.mounted_servers,
                    "ready": True
                })
            }
            
            # Keep connection alive
            while True:
                await asyncio.sleep(30)
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": asyncio.get_event_loop().time()})
                }
                
        except asyncio.CancelledError:
            logger.info("sse_connection_closed")
            raise
    
    return EventSourceResponse(event_generator())

# Import health endpoints from health_server
import health_server
from health_server import health_app, health_monitor

# Create middleware
middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

# Starlette app with routes
app = Starlette(
    routes=[
        Route("/sse", sse_endpoint, methods=["GET", "POST"]),
        Route("/mcp", sse_endpoint, methods=["GET", "POST"]),  # Alternative endpoint
        Mount("/", app=health_app),  # Mount health endpoints at root
    ],
    middleware=middleware
)

async def startup():
    """Application startup"""
    global aggregator
    
    # Parse configuration from environment
    config_json = os.environ.get('WORKSPACE_CONFIG')
    if not config_json:
        logger.error("missing_workspace_config")
        sys.exit(1)
        
    try:
        config = json.loads(config_json)
        logger.info("config_loaded", workspace=config['workspace']['name'])
    except json.JSONDecodeError as e:
        logger.error("invalid_config_json", error=str(e))
        sys.exit(1)
        
    # Initialize aggregator
    aggregator = MCPAggregator(config)
    await aggregator.initialize()
    
    # Set aggregator reference in health_server
    health_server.aggregator = aggregator
    
    # Mark health monitor as ready if we have mounted servers
    if len(aggregator.mounted_servers) > 0:
        health_monitor.set_ready(True)
    
    logger.info("aggregator_ready", 
               workspace=aggregator.workspace_name,
               servers=len(aggregator.mounted_servers))

async def shutdown():
    """Application shutdown"""
    if aggregator:
        await aggregator.shutdown()

# Register lifecycle events
app.add_event_handler("startup", startup)
app.add_event_handler("shutdown", shutdown)

# Handle signals for graceful shutdown
def signal_handler(sig, frame):
    logger.info("signal_received", signal=sig)
    if aggregator:
        asyncio.create_task(aggregator.shutdown())
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

if __name__ == "__main__":
    # Run the SSE server on port 8080
    uvicorn.run(app, host="0.0.0.0", port=8080, log_config=None)