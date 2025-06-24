#!/usr/bin/env python3
"""
FastMCP Aggregator for MCP Workspace
Aggregates multiple MCP servers into a single SSE endpoint
"""

import asyncio
import json
import os
import sys
import time
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
        start_time = time.time()
        logger.info("initializing_aggregator", workspace=self.workspace_name)
        
        successful_mounts = 0
        failed_mounts = 0
        
        # Mount each server based on configuration
        for server_config in self.servers:
            try:
                await self._mount_server(server_config)
                successful_mounts += 1
            except Exception as e:
                failed_mounts += 1
                logger.error("server_mount_failed", 
                           server=server_config['name'],
                           error=str(e),
                           exc_info=True)
                # Continue with other servers even if one fails
        
        initialization_time = time.time() - start_time
        logger.info("aggregator_initialization_complete",
                    workspace=self.workspace_name,
                    successful_mounts=successful_mounts,
                    failed_mounts=failed_mounts,
                    total_servers=len(self.servers),
                    initialization_time_seconds=round(initialization_time, 2))
                
    async def _mount_server(self, server_config: Dict[str, Any]) -> None:
        """Mount a single MCP server"""
        server_name = server_config['name']
        command = server_config['command']
        args = server_config.get('args', [])
        env = server_config.get('env', {})
        workdir = server_config.get('workdir')
        
        mount_start_time = time.time()
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
        
        process = None
        try:
            # Start the server process
            logger.debug("starting_server_process", server=server_name, command=full_command)
            process = subprocess.Popen(
                full_command,
                env=server_env,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Store process reference immediately
            self.server_processes[server_name] = process
            
            # Give server time to start
            await asyncio.sleep(2)
            
            # Check if process is still running
            if process.poll() is not None:
                stderr = process.stderr.read().decode() if process.stderr else ''
                stdout = process.stdout.read().decode() if process.stdout else ''
                logger.error("server_process_exited_immediately",
                           server=server_name,
                           stderr=stderr,
                           stdout=stdout,
                           exit_code=process.returncode)
                raise RuntimeError(f"Server process exited immediately with code {process.returncode}: {stderr}")
            
            # Mount the server with FastMCP
            # FastMCP mount expects the server to be accessible via stdio
            try:
                logger.debug("attempting_fastmcp_mount", server=server_name)
                
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
                
                mount_time = time.time() - mount_start_time
                logger.info("server_mounted_successfully",
                          server=server_name,
                          mount_time_seconds=round(mount_time, 2))
                
            except Exception as mount_error:
                logger.error("fastmcp_mount_failed",
                           server=server_name,
                           error=str(mount_error),
                           exc_info=True)
                # Kill the process if mount fails
                if process and process.poll() is None:
                    logger.debug("terminating_failed_mount_process", server=server_name)
                    process.terminate()
                    await asyncio.sleep(0.5)
                    if process.poll() is None:
                        process.kill()
                raise mount_error
            
        except subprocess.SubprocessError as e:
            logger.error("subprocess_error",
                       server=server_name,
                       command=full_command,
                       error=str(e),
                       exc_info=True)
            # Clean up process if it exists
            if process and server_name in self.server_processes:
                del self.server_processes[server_name]
            raise
        except Exception as e:
            logger.error("server_start_failed", 
                       server=server_name,
                       command=full_command,
                       error=str(e),
                       exc_info=True)
            # Clean up process if it exists
            if process and server_name in self.server_processes:
                del self.server_processes[server_name]
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
        server_statuses = {}
        
        for server_name, process in self.server_processes.items():
            try:
                if process.poll() is None:
                    running_servers.append(server_name)
                    server_statuses[server_name] = {
                        "status": "running",
                        "pid": process.pid,
                        "mounted": server_name in self.mounted_servers
                    }
                else:
                    failed_servers.append(server_name)
                    server_statuses[server_name] = {
                        "status": "failed",
                        "exit_code": process.returncode,
                        "mounted": server_name in self.mounted_servers
                    }
            except Exception as e:
                logger.warning("status_check_error",
                             server=server_name,
                             error=str(e))
                server_statuses[server_name] = {
                    "status": "unknown",
                    "error": str(e)
                }
                
        return {
            "workspace": self.workspace_name,
            "mounted_servers": self.mounted_servers,
            "running_servers": running_servers,
            "failed_servers": failed_servers,
            "total_servers": len(self.servers),
            "server_details": server_statuses
        }


# Global aggregator instance
aggregator: Optional[MCPAggregator] = None

async def sse_endpoint(request):
    """SSE endpoint for MCP protocol"""
    client_id = request.headers.get("X-Client-ID", "unknown")
    logger.info("sse_endpoint_requested",
                method=request.method,
                client_id=client_id,
                user_agent=request.headers.get("User-Agent"))
    
    if not aggregator:
        logger.error("aggregator_not_initialized")
        return JSONResponse(
            {"error": "Aggregator not initialized"},
            status_code=500
        )
    
    # Check aggregator health
    status = aggregator.get_status()
    if len(status["mounted_servers"]) == 0:
        logger.warning("no_servers_mounted", status=status)
        return JSONResponse(
            {"error": "No servers available", "status": status},
            status_code=503
        )
    
    # FastMCP handles the SSE protocol for MCP
    # Get the request body if it's a POST request
    if request.method == "POST":
        try:
            body = await request.body()
            logger.debug("sse_post_request", body_size=len(body), client_id=client_id)
            
            # FastMCP will handle the MCP protocol messages
            # For now, we'll create a basic SSE response
            async def event_generator():
                """Generate SSE events for MCP protocol"""
                connection_start = time.time()
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
                    ping_count = 0
                    while True:
                        await asyncio.sleep(30)
                        ping_count += 1
                        yield {
                            "event": "ping",
                            "data": json.dumps({
                                "timestamp": asyncio.get_event_loop().time(),
                                "ping_count": ping_count,
                                "connection_duration": time.time() - connection_start
                            })
                        }
                        
                except asyncio.CancelledError:
                    duration = time.time() - connection_start
                    logger.info("sse_connection_closed",
                              client_id=client_id,
                              duration_seconds=round(duration, 2),
                              ping_count=ping_count)
                    raise
                except Exception as e:
                    logger.error("sse_generator_error",
                               error=str(e),
                               client_id=client_id,
                               exc_info=True)
                    raise
            
            return EventSourceResponse(event_generator())
            
        except Exception as e:
            logger.error("sse_request_error",
                       error=str(e),
                       client_id=client_id,
                       exc_info=True)
            return JSONResponse({"error": str(e)}, status_code=400)
    
    # For GET requests, return SSE stream
    async def event_generator():
        """Generate SSE events for MCP protocol"""
        connection_start = time.time()
        heartbeat_count = 0
        try:
            # Send connection established event
            yield {
                "event": "open",
                "data": json.dumps({
                    "workspace": aggregator.workspace_name,
                    "servers": aggregator.mounted_servers,
                    "ready": True,
                    "status": status
                })
            }
            
            # Keep connection alive
            while True:
                await asyncio.sleep(30)
                heartbeat_count += 1
                
                # Check server health periodically
                current_status = aggregator.get_status()
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({
                        "timestamp": asyncio.get_event_loop().time(),
                        "heartbeat_count": heartbeat_count,
                        "connection_duration": time.time() - connection_start,
                        "servers_healthy": len(current_status["running_servers"]),
                        "servers_failed": len(current_status["failed_servers"])
                    })
                }
                
        except asyncio.CancelledError:
            duration = time.time() - connection_start
            logger.info("sse_get_connection_closed",
                      client_id=client_id,
                      duration_seconds=round(duration, 2),
                      heartbeat_count=heartbeat_count)
            raise
        except Exception as e:
            logger.error("sse_get_generator_error",
                       error=str(e),
                       client_id=client_id,
                       exc_info=True)
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
    startup_time = time.time()
    
    try:
        # Parse configuration from environment
        config_json = os.environ.get('WORKSPACE_CONFIG')
        if not config_json:
            logger.error("missing_workspace_config",
                       env_vars=list(os.environ.keys()))
            sys.exit(1)
            
        try:
            config = json.loads(config_json)
            logger.info("config_loaded",
                       workspace=config['workspace']['name'],
                       server_count=len(config.get('workspace', {}).get('servers', [])))
        except json.JSONDecodeError as e:
            logger.error("invalid_config_json",
                       error=str(e),
                       config_preview=config_json[:200] if config_json else None)
            sys.exit(1)
        except KeyError as e:
            logger.error("invalid_config_structure",
                       error=str(e),
                       keys=list(config.keys()) if 'config' in locals() else None)
            sys.exit(1)
            
        # Initialize aggregator
        aggregator = MCPAggregator(config)
        await aggregator.initialize()
        
        # Set aggregator reference in health_server
        health_server.aggregator = aggregator
        
        # Mark health monitor as ready if we have mounted servers
        if len(aggregator.mounted_servers) > 0:
            health_monitor.set_ready(True)
            logger.info("health_monitor_ready",
                       mounted_servers=aggregator.mounted_servers)
        else:
            logger.warning("no_servers_mounted_at_startup",
                         total_servers=len(aggregator.servers))
        
        startup_duration = time.time() - startup_time
        logger.info("aggregator_startup_complete", 
                   workspace=aggregator.workspace_name,
                   mounted_servers=len(aggregator.mounted_servers),
                   failed_servers=len(aggregator.servers) - len(aggregator.mounted_servers),
                   startup_time_seconds=round(startup_duration, 2))
        
    except Exception as e:
        logger.error("startup_failed",
                   error=str(e),
                   exc_info=True)
        # Try to clean up if aggregator was partially initialized
        if aggregator:
            try:
                await aggregator.shutdown()
            except Exception as cleanup_error:
                logger.error("cleanup_failed",
                           error=str(cleanup_error))
        sys.exit(1)

async def shutdown():
    """Application shutdown"""
    shutdown_start = time.time()
    logger.info("application_shutdown_started")
    
    try:
        if aggregator:
            await aggregator.shutdown()
            shutdown_duration = time.time() - shutdown_start
            logger.info("application_shutdown_complete",
                       duration_seconds=round(shutdown_duration, 2))
        else:
            logger.warning("shutdown_called_without_aggregator")
    except Exception as e:
        logger.error("shutdown_error",
                   error=str(e),
                   exc_info=True)

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