#!/usr/bin/env python3
"""
Health Server for MCP Workspace
Provides health, readiness, status, and metrics endpoints
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional
import structlog
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import psutil
import os

# Configure structured logging
logger = structlog.get_logger()

class HealthMonitor:
    """Monitors workspace health and metrics"""
    
    def __init__(self):
        self.start_time = time.time()
        self.ready = False
        self.last_health_check = None
        self.metrics = {
            "requests_total": 0,
            "errors_total": 0,
            "server_restarts": 0,
            "last_error": None
        }
        
    def set_ready(self, ready: bool) -> None:
        """Set readiness status"""
        self.ready = ready
        logger.info("readiness_changed", ready=ready)
        
    def record_request(self) -> None:
        """Record a request metric"""
        self.metrics["requests_total"] += 1
        
    def record_error(self, error: str) -> None:
        """Record an error metric"""
        self.metrics["errors_total"] += 1
        self.metrics["last_error"] = {
            "message": error,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    def record_server_restart(self) -> None:
        """Record a server restart"""
        self.metrics["server_restarts"] += 1
        
    def get_uptime(self) -> float:
        """Get uptime in seconds"""
        return time.time() - self.start_time
        
    def get_health_status(self, aggregator_status: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get comprehensive health status"""
        # Basic system metrics
        process = psutil.Process()
        memory_info = process.memory_info()
        
        health = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": self.get_uptime(),
            "ready": self.ready,
            "system": {
                "memory_mb": memory_info.rss / 1024 / 1024,
                "memory_percent": process.memory_percent(),
                "cpu_percent": process.cpu_percent(interval=0.1),
                "num_threads": process.num_threads()
            }
        }
        
        # Add aggregator status if available
        if aggregator_status:
            health["aggregator"] = aggregator_status
            
            # Determine overall health based on aggregator status
            failed_servers = aggregator_status.get("failed_servers", [])
            mounted_servers = aggregator_status.get("mounted_servers", [])
            
            if len(failed_servers) > 0:
                health["status"] = "degraded"
                health["issues"] = [f"Server '{server}' failed" for server in failed_servers]
            elif len(mounted_servers) == 0:
                health["status"] = "unhealthy"
                health["issues"] = ["No servers mounted"]
        
        return health
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get prometheus-style metrics"""
        process = psutil.Process()
        memory_info = process.memory_info()
        
        return {
            # Counter metrics
            "workspace_requests_total": self.metrics["requests_total"],
            "workspace_errors_total": self.metrics["errors_total"],
            "workspace_server_restarts_total": self.metrics["server_restarts"],
            
            # Gauge metrics
            "workspace_uptime_seconds": self.get_uptime(),
            "workspace_memory_bytes": memory_info.rss,
            "workspace_memory_percent": process.memory_percent(),
            "workspace_cpu_percent": process.cpu_percent(interval=0.1),
            "workspace_threads": process.num_threads(),
            "workspace_ready": 1 if self.ready else 0,
            
            # Info metrics
            "workspace_info": {
                "version": "1.0.0",
                "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}"
            },
            
            # Last error if any
            "workspace_last_error": self.metrics["last_error"]
        }


# Global health monitor
health_monitor = HealthMonitor()

# Aggregator reference will be set by the main application
aggregator = None

async def health_endpoint(request):
    """
    Health endpoint - returns 200 if healthy, 503 if unhealthy
    Used by Docker health checks and load balancers
    """
    health_monitor.record_request()
    
    # Get aggregator status if available
    agg_status = None
    if aggregator:
        agg_status = aggregator.get_status()
    
    health_status = health_monitor.get_health_status(agg_status)
    
    # Determine HTTP status code
    if health_status["status"] == "healthy":
        status_code = 200
    elif health_status["status"] == "degraded":
        status_code = 200  # Still return 200 for degraded but operational
    else:
        status_code = 503  # Service unavailable
    
    return JSONResponse(health_status, status_code=status_code)

async def ready_endpoint(request):
    """
    Readiness endpoint - returns 200 if ready to serve traffic, 503 if not
    Used by Kubernetes readiness probes
    """
    health_monitor.record_request()
    
    ready_status = {
        "ready": health_monitor.ready,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Check if aggregator has mounted servers
    if aggregator:
        agg_status = aggregator.get_status()
        mounted_count = len(agg_status.get("mounted_servers", []))
        ready_status["mounted_servers"] = mounted_count
        
        # Only ready if we have at least one mounted server
        if mounted_count == 0:
            ready_status["ready"] = False
            ready_status["reason"] = "No servers mounted"
    
    status_code = 200 if ready_status["ready"] else 503
    return JSONResponse(ready_status, status_code=status_code)

async def status_endpoint(request):
    """
    Status endpoint - returns detailed status information
    Always returns 200 with comprehensive status data
    """
    health_monitor.record_request()
    
    # Get aggregator status
    agg_status = None
    if aggregator:
        agg_status = aggregator.get_status()
    
    # Get health status
    health_status = health_monitor.get_health_status(agg_status)
    
    # Add additional status information
    status = {
        **health_status,
        "metrics_summary": {
            "total_requests": health_monitor.metrics["requests_total"],
            "total_errors": health_monitor.metrics["errors_total"],
            "server_restarts": health_monitor.metrics["server_restarts"]
        }
    }
    
    return JSONResponse(status)

async def metrics_endpoint(request):
    """
    Metrics endpoint - returns Prometheus-compatible metrics
    Format: metric_name{labels} value
    """
    health_monitor.record_request()
    
    metrics = health_monitor.get_metrics()
    
    # Format as Prometheus text format
    lines = []
    
    # Add help and type comments
    lines.append("# HELP workspace_requests_total Total number of requests")
    lines.append("# TYPE workspace_requests_total counter")
    lines.append(f"workspace_requests_total {metrics['workspace_requests_total']}")
    
    lines.append("# HELP workspace_errors_total Total number of errors")
    lines.append("# TYPE workspace_errors_total counter")
    lines.append(f"workspace_errors_total {metrics['workspace_errors_total']}")
    
    lines.append("# HELP workspace_server_restarts_total Total number of server restarts")
    lines.append("# TYPE workspace_server_restarts_total counter")
    lines.append(f"workspace_server_restarts_total {metrics['workspace_server_restarts_total']}")
    
    lines.append("# HELP workspace_uptime_seconds Uptime in seconds")
    lines.append("# TYPE workspace_uptime_seconds gauge")
    lines.append(f"workspace_uptime_seconds {metrics['workspace_uptime_seconds']:.2f}")
    
    lines.append("# HELP workspace_memory_bytes Memory usage in bytes")
    lines.append("# TYPE workspace_memory_bytes gauge")
    lines.append(f"workspace_memory_bytes {metrics['workspace_memory_bytes']}")
    
    lines.append("# HELP workspace_cpu_percent CPU usage percentage")
    lines.append("# TYPE workspace_cpu_percent gauge")
    lines.append(f"workspace_cpu_percent {metrics['workspace_cpu_percent']:.2f}")
    
    lines.append("# HELP workspace_ready Readiness status (1=ready, 0=not ready)")
    lines.append("# TYPE workspace_ready gauge")
    lines.append(f"workspace_ready {metrics['workspace_ready']}")
    
    # Add workspace info
    info = metrics['workspace_info']
    lines.append("# HELP workspace_info Workspace information")
    lines.append("# TYPE workspace_info gauge")
    lines.append(f'workspace_info{{version="{info["version"]}",python_version="{info["python_version"]}"}} 1')
    
    # Join with newlines and add final newline
    prometheus_text = "\n".join(lines) + "\n"
    
    from starlette.responses import PlainTextResponse
    return PlainTextResponse(
        content=prometheus_text,
        media_type="text/plain; version=0.0.4"
    )

# Create Starlette app for health endpoints
health_app = Starlette(
    routes=[
        Route("/health", health_endpoint, methods=["GET"]),
        Route("/ready", ready_endpoint, methods=["GET"]),
        Route("/status", status_endpoint, methods=["GET"]),
        Route("/metrics", metrics_endpoint, methods=["GET"]),
    ]
)

async def startup():
    """Health server startup"""
    logger.info("health_server_starting")
    
    # Mark as ready after a short delay to allow aggregator to initialize
    async def mark_ready():
        await asyncio.sleep(5)
        health_monitor.set_ready(True)
    
    asyncio.create_task(mark_ready())

# Register startup event
health_app.add_event_handler("startup", startup)

# Export for use by aggregator
__all__ = ['health_app', 'health_monitor']