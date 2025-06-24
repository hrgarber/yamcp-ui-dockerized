#!/usr/bin/env python3
"""
Tests for Health Server
"""

import pytest
import asyncio
import json
import time
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from starlette.testclient import TestClient
import health_server
from health_server import (
    HealthMonitor, health_endpoint, ready_endpoint,
    status_endpoint, metrics_endpoint, health_app
)


@pytest.fixture
def health_monitor():
    """Create a fresh health monitor instance"""
    return HealthMonitor()


@pytest.fixture
def mock_aggregator():
    """Create a mock aggregator with sample status"""
    mock_agg = Mock()
    mock_agg.get_status.return_value = {
        "workspace": "test-workspace",
        "mounted_servers": ["server1", "server2"],
        "running_servers": ["server1", "server2"],
        "failed_servers": [],
        "total_servers": 2,
        "server_details": {
            "server1": {"status": "running", "pid": 12345, "mounted": True},
            "server2": {"status": "running", "pid": 12346, "mounted": True}
        }
    }
    return mock_agg


@pytest.fixture
def client():
    """Create test client for the health app"""
    return TestClient(health_app)


class TestHealthMonitor:
    """Test suite for HealthMonitor class"""
    
    def test_initialization(self, health_monitor):
        """Test health monitor initialization"""
        assert health_monitor.ready is False
        assert health_monitor.metrics["requests_total"] == 0
        assert health_monitor.metrics["errors_total"] == 0
        assert health_monitor.metrics["server_restarts"] == 0
        assert health_monitor.metrics["last_error"] is None
    
    def test_set_ready(self, health_monitor):
        """Test setting readiness status"""
        assert health_monitor.ready is False
        
        health_monitor.set_ready(True)
        assert health_monitor.ready is True
        
        health_monitor.set_ready(False)
        assert health_monitor.ready is False
    
    def test_record_request(self, health_monitor):
        """Test request counting"""
        initial_count = health_monitor.metrics["requests_total"]
        
        health_monitor.record_request()
        assert health_monitor.metrics["requests_total"] == initial_count + 1
        
        health_monitor.record_request()
        assert health_monitor.metrics["requests_total"] == initial_count + 2
    
    def test_record_error(self, health_monitor):
        """Test error recording"""
        assert health_monitor.metrics["errors_total"] == 0
        assert health_monitor.metrics["last_error"] is None
        
        health_monitor.record_error("Test error occurred")
        
        assert health_monitor.metrics["errors_total"] == 1
        assert health_monitor.metrics["last_error"]["message"] == "Test error occurred"
        assert "timestamp" in health_monitor.metrics["last_error"]
    
    def test_record_server_restart(self, health_monitor):
        """Test server restart recording"""
        initial_count = health_monitor.metrics["server_restarts"]
        
        health_monitor.record_server_restart()
        assert health_monitor.metrics["server_restarts"] == initial_count + 1
    
    def test_get_uptime(self, health_monitor):
        """Test uptime calculation"""
        # Sleep a bit to ensure uptime is > 0
        time.sleep(0.1)
        
        uptime = health_monitor.get_uptime()
        assert uptime > 0.1
        assert isinstance(uptime, float)
    
    def test_get_health_status_healthy(self, health_monitor, mock_aggregator):
        """Test health status when everything is healthy"""
        health_monitor.ready = True
        
        status = health_monitor.get_health_status(mock_aggregator.get_status())
        
        assert status["status"] == "healthy"
        assert status["ready"] is True
        assert "timestamp" in status
        assert "uptime_seconds" in status
        assert "system" in status
        assert "aggregator" in status
    
    def test_get_health_status_degraded(self, health_monitor):
        """Test health status when some servers failed"""
        health_monitor.ready = True
        
        agg_status = {
            "mounted_servers": ["server1", "server2"],
            "running_servers": ["server1"],
            "failed_servers": ["server2"]
        }
        
        status = health_monitor.get_health_status(agg_status)
        
        assert status["status"] == "degraded"
        assert "issues" in status
        assert len(status["issues"]) == 1
        assert "server2" in status["issues"][0]
    
    def test_get_health_status_unhealthy(self, health_monitor):
        """Test health status when no servers are mounted"""
        health_monitor.ready = True
        
        agg_status = {
            "mounted_servers": [],
            "running_servers": [],
            "failed_servers": []
        }
        
        status = health_monitor.get_health_status(agg_status)
        
        assert status["status"] == "unhealthy"
        assert "issues" in status
        assert "No servers mounted" in status["issues"][0]
    
    def test_get_metrics(self, health_monitor):
        """Test metrics generation"""
        # Set up some test data
        health_monitor.ready = True
        health_monitor.metrics["requests_total"] = 42
        health_monitor.metrics["errors_total"] = 3
        
        metrics = health_monitor.get_metrics()
        
        assert metrics["workspace_requests_total"] == 42
        assert metrics["workspace_errors_total"] == 3
        assert metrics["workspace_ready"] == 1
        assert "workspace_uptime_seconds" in metrics
        assert "workspace_memory_bytes" in metrics
        assert "workspace_cpu_percent" in metrics
        assert "workspace_info" in metrics


class TestHealthEndpoints:
    """Test suite for health endpoints"""
    
    @pytest.mark.asyncio
    async def test_health_endpoint_healthy(self, mock_aggregator):
        """Test health endpoint when service is healthy"""
        # Set up aggregator
        health_server.aggregator = mock_aggregator
        
        # Mock request
        mock_request = Mock()
        
        # Mock health monitor
        with patch.object(health_server.health_monitor, 'get_health_status') as mock_get_status:
            mock_get_status.return_value = {
                "status": "healthy",
                "ready": True,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            response = await health_endpoint(mock_request)
            
            assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_health_endpoint_degraded(self):
        """Test health endpoint when service is degraded"""
        mock_request = Mock()
        
        with patch.object(health_server.health_monitor, 'get_health_status') as mock_get_status:
            mock_get_status.return_value = {
                "status": "degraded",
                "ready": True,
                "issues": ["Server 'test' failed"]
            }
            
            response = await health_endpoint(mock_request)
            
            assert response.status_code == 200  # Still 200 for degraded
    
    @pytest.mark.asyncio
    async def test_health_endpoint_unhealthy(self):
        """Test health endpoint when service is unhealthy"""
        mock_request = Mock()
        
        with patch.object(health_server.health_monitor, 'get_health_status') as mock_get_status:
            mock_get_status.return_value = {
                "status": "unhealthy",
                "ready": False
            }
            
            response = await health_endpoint(mock_request)
            
            assert response.status_code == 503
    
    @pytest.mark.asyncio
    async def test_health_endpoint_error(self):
        """Test health endpoint error handling"""
        mock_request = Mock()
        
        # Make get_status raise an exception
        with patch.object(health_server.health_monitor, 'get_health_status') as mock_get_status:
            mock_get_status.side_effect = Exception("Test error")
            
            response = await health_endpoint(mock_request)
            
            assert response.status_code == 500
            body = json.loads(response.body)
            assert "error" in body
    
    @pytest.mark.asyncio
    async def test_ready_endpoint_ready(self, mock_aggregator):
        """Test ready endpoint when service is ready"""
        health_server.aggregator = mock_aggregator
        health_server.health_monitor.ready = True
        
        mock_request = Mock()
        
        response = await ready_endpoint(mock_request)
        
        assert response.status_code == 200
        body = json.loads(response.body)
        assert body["ready"] is True
        assert body["mounted_servers"] == 2
    
    @pytest.mark.asyncio
    async def test_ready_endpoint_not_ready_no_servers(self, mock_aggregator):
        """Test ready endpoint when no servers are mounted"""
        mock_aggregator.get_status.return_value = {
            "mounted_servers": [],
            "running_servers": [],
            "failed_servers": []
        }
        health_server.aggregator = mock_aggregator
        
        mock_request = Mock()
        
        response = await ready_endpoint(mock_request)
        
        assert response.status_code == 503
        body = json.loads(response.body)
        assert body["ready"] is False
        assert body["reason"] == "No servers mounted"
    
    @pytest.mark.asyncio
    async def test_ready_endpoint_no_aggregator(self):
        """Test ready endpoint when aggregator is not initialized"""
        health_server.aggregator = None
        
        mock_request = Mock()
        
        response = await ready_endpoint(mock_request)
        
        assert response.status_code == 503
        body = json.loads(response.body)
        assert body["ready"] is False
        assert body["reason"] == "Aggregator not initialized"
    
    @pytest.mark.asyncio
    async def test_status_endpoint(self, mock_aggregator):
        """Test status endpoint"""
        health_server.aggregator = mock_aggregator
        health_server.health_monitor.metrics["requests_total"] = 100
        health_server.health_monitor.metrics["errors_total"] = 5
        
        mock_request = Mock()
        
        with patch.object(health_server.health_monitor, 'get_health_status') as mock_get_status:
            mock_get_status.return_value = {
                "status": "healthy",
                "ready": True,
                "uptime_seconds": 300
            }
            
            response = await status_endpoint(mock_request)
            
            assert response.status_code == 200
            body = json.loads(response.body)
            assert body["status"] == "healthy"
            assert body["metrics_summary"]["total_requests"] == 100
            assert body["metrics_summary"]["total_errors"] == 5
    
    @pytest.mark.asyncio
    async def test_metrics_endpoint(self):
        """Test metrics endpoint Prometheus format"""
        mock_request = Mock()
        
        # Set up some metrics
        health_server.health_monitor.metrics["requests_total"] = 42
        health_server.health_monitor.metrics["errors_total"] = 3
        health_server.health_monitor.ready = True
        
        response = await metrics_endpoint(mock_request)
        
        assert response.status_code == 200
        assert response.media_type == "text/plain; version=0.0.4"
        
        # Check content includes expected metrics
        content = response.body.decode()
        assert "workspace_requests_total 42" in content
        assert "workspace_errors_total 3" in content
        assert "workspace_ready 1" in content
        assert "# HELP" in content
        assert "# TYPE" in content


class TestHealthApp:
    """Test suite for the health app using test client"""
    
    def test_health_endpoint_via_client(self, client, mock_aggregator):
        """Test health endpoint through test client"""
        health_server.aggregator = mock_aggregator
        
        response = client.get("/health")
        
        assert response.status_code in [200, 503]
        assert "status" in response.json()
    
    def test_ready_endpoint_via_client(self, client):
        """Test ready endpoint through test client"""
        response = client.get("/ready")
        
        assert response.status_code in [200, 503]
        data = response.json()
        assert "ready" in data
        assert isinstance(data["ready"], bool)
    
    def test_status_endpoint_via_client(self, client):
        """Test status endpoint through test client"""
        response = client.get("/status")
        
        assert response.status_code == 200
        data = response.json()
        assert "metrics_summary" in data
    
    def test_metrics_endpoint_via_client(self, client):
        """Test metrics endpoint through test client"""
        response = client.get("/metrics")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; version=0.0.4; charset=utf-8"
        
        # Verify Prometheus format
        content = response.text
        assert "# HELP" in content
        assert "workspace_requests_total" in content


class TestStartup:
    """Test suite for startup function"""
    
    @pytest.mark.asyncio
    async def test_startup_auto_ready(self):
        """Test that startup sets ready after delay"""
        # Reset health monitor
        health_server.health_monitor.ready = False
        
        # Run startup
        await health_server.startup()
        
        # Initially should not be ready
        assert health_server.health_monitor.ready is False
        
        # Wait for auto-ready
        await asyncio.sleep(5.1)
        
        # Now should be ready
        assert health_server.health_monitor.ready is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])