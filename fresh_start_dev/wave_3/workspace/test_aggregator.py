#!/usr/bin/env python3
"""
Tests for MCPAggregator
"""

import pytest
import asyncio
import json
import os
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import subprocess
from aggregator import MCPAggregator, sse_endpoint, startup, shutdown
import aggregator as aggregator_module


@pytest.fixture
def sample_config():
    """Sample configuration for testing"""
    return {
        "workspace": {
            "name": "test-workspace",
            "servers": [
                {
                    "name": "test-server-1",
                    "command": "python",
                    "args": ["-m", "test_server"],
                    "env": {"TEST_ENV": "value"}
                },
                {
                    "name": "test-server-2",
                    "command": "node",
                    "args": ["server.js", "${TEST_VAR}"],
                    "workdir": "/test/dir"
                }
            ]
        }
    }


@pytest.fixture
def aggregator(sample_config):
    """Create an aggregator instance"""
    return MCPAggregator(sample_config)


class TestMCPAggregator:
    """Test suite for MCPAggregator"""
    
    @pytest.mark.asyncio
    async def test_initialization(self, aggregator, sample_config):
        """Test aggregator initialization"""
        assert aggregator.workspace_name == "test-workspace"
        assert len(aggregator.servers) == 2
        assert aggregator.server_processes == {}
        assert aggregator.mounted_servers == []
    
    @pytest.mark.asyncio
    async def test_successful_server_mount(self, aggregator, sample_config):
        """Test successful server mounting"""
        # Mock subprocess.Popen
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        mock_process.pid = 12345
        mock_process.returncode = None
        
        # Mock FastMCP mount
        aggregator.mcp.mount = Mock()
        
        with patch('subprocess.Popen', return_value=mock_process):
            with patch.dict(os.environ, {'TEST_VAR': 'test_value'}):
                await aggregator._mount_server(sample_config['workspace']['servers'][0])
        
        # Verify process was started
        assert 'test-server-1' in aggregator.server_processes
        assert aggregator.server_processes['test-server-1'] == mock_process
        
        # Verify server was mounted
        aggregator.mcp.mount.assert_called_once()
        assert 'test-server-1' in aggregator.mounted_servers
    
    @pytest.mark.asyncio
    async def test_server_mount_with_env_substitution(self, aggregator, sample_config):
        """Test server mounting with environment variable substitution"""
        mock_process = Mock()
        mock_process.poll.return_value = None
        mock_process.pid = 12346
        
        aggregator.mcp.mount = Mock()
        
        with patch('subprocess.Popen', return_value=mock_process) as mock_popen:
            with patch.dict(os.environ, {'TEST_VAR': 'substituted_value'}):
                await aggregator._mount_server(sample_config['workspace']['servers'][1])
        
        # Check that the environment variable was substituted
        call_args = mock_popen.call_args[0][0]
        assert 'substituted_value' in call_args
        assert '${TEST_VAR}' not in str(call_args)
    
    @pytest.mark.asyncio
    async def test_server_mount_process_exit_immediately(self, aggregator, sample_config):
        """Test handling of server process that exits immediately"""
        mock_process = Mock()
        mock_process.poll.side_effect = [None, 1]  # First check: running, second: exited
        mock_process.returncode = 1
        mock_process.stderr = Mock()
        mock_process.stderr.read.return_value = b"Error: Failed to start"
        mock_process.stdout = Mock()
        mock_process.stdout.read.return_value = b""
        
        with patch('subprocess.Popen', return_value=mock_process):
            with pytest.raises(RuntimeError) as excinfo:
                await aggregator._mount_server(sample_config['workspace']['servers'][0])
        
        assert "Server process exited immediately" in str(excinfo.value)
        assert "test-server-1" not in aggregator.mounted_servers
    
    @pytest.mark.asyncio
    async def test_server_mount_fastmcp_failure(self, aggregator, sample_config):
        """Test handling of FastMCP mount failure"""
        mock_process = Mock()
        mock_process.poll.return_value = None
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        
        # Make FastMCP mount raise an exception
        aggregator.mcp.mount = Mock(side_effect=Exception("Mount failed"))
        
        with patch('subprocess.Popen', return_value=mock_process):
            with pytest.raises(Exception) as excinfo:
                await aggregator._mount_server(sample_config['workspace']['servers'][0])
        
        assert "Mount failed" in str(excinfo.value)
        mock_process.terminate.assert_called_once()
        assert "test-server-1" not in aggregator.mounted_servers
    
    @pytest.mark.asyncio
    async def test_initialize_with_mixed_results(self, aggregator, sample_config):
        """Test initialize with some servers succeeding and some failing"""
        # First server succeeds
        mock_process1 = Mock()
        mock_process1.poll.return_value = None
        mock_process1.pid = 12345
        
        # Second server fails
        mock_process2 = Mock()
        mock_process2.poll.side_effect = [None, 1]
        mock_process2.returncode = 1
        mock_process2.stderr = Mock()
        mock_process2.stderr.read.return_value = b"Failed"
        mock_process2.stdout = Mock()
        mock_process2.stdout.read.return_value = b""
        
        aggregator.mcp.mount = Mock()
        
        with patch('subprocess.Popen', side_effect=[mock_process1, mock_process2]):
            with patch.dict(os.environ, {'TEST_VAR': 'value'}):
                await aggregator.initialize()
        
        # First server should be mounted
        assert 'test-server-1' in aggregator.mounted_servers
        assert 'test-server-1' in aggregator.server_processes
        
        # Second server should not be mounted
        assert 'test-server-2' not in aggregator.mounted_servers
    
    @pytest.mark.asyncio
    async def test_shutdown(self, aggregator):
        """Test graceful shutdown of servers"""
        # Create mock processes
        mock_process1 = Mock()
        mock_process1.poll.return_value = None
        mock_process1.terminate = Mock()
        mock_process1.kill = Mock()
        
        mock_process2 = Mock()
        mock_process2.poll.return_value = None
        mock_process2.terminate = Mock()
        mock_process2.kill = Mock()
        
        aggregator.server_processes = {
            'server1': mock_process1,
            'server2': mock_process2
        }
        
        await aggregator.shutdown()
        
        # Both processes should be terminated
        mock_process1.terminate.assert_called_once()
        mock_process2.terminate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_shutdown_with_stubborn_process(self, aggregator):
        """Test shutdown with process that doesn't terminate gracefully"""
        mock_process = Mock()
        mock_process.poll.side_effect = [None, None, None]  # Doesn't terminate
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        
        aggregator.server_processes = {'stubborn': mock_process}
        
        await aggregator.shutdown()
        
        # Should try terminate first, then kill
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()
    
    def test_get_status(self, aggregator):
        """Test status reporting"""
        # Create mock processes
        running_process = Mock()
        running_process.poll.return_value = None
        running_process.pid = 12345
        
        failed_process = Mock()
        failed_process.poll.return_value = 1
        failed_process.returncode = 1
        
        aggregator.server_processes = {
            'running-server': running_process,
            'failed-server': failed_process
        }
        aggregator.mounted_servers = ['running-server', 'failed-server']
        aggregator.servers = [1, 2, 3]  # Just for count
        
        status = aggregator.get_status()
        
        assert status['workspace'] == 'test-workspace'
        assert 'running-server' in status['running_servers']
        assert 'failed-server' in status['failed_servers']
        assert len(status['mounted_servers']) == 2
        assert status['total_servers'] == 3
        assert status['server_details']['running-server']['status'] == 'running'
        assert status['server_details']['failed-server']['status'] == 'failed'


class TestSSEEndpoint:
    """Test suite for SSE endpoint"""
    
    @pytest.mark.asyncio
    async def test_sse_endpoint_no_aggregator(self):
        """Test SSE endpoint when aggregator is not initialized"""
        # Mock request
        mock_request = Mock()
        mock_request.headers = {'X-Client-ID': 'test-client'}
        mock_request.method = "GET"
        
        # Ensure aggregator is None
        aggregator_module.aggregator = None
        
        response = await sse_endpoint(mock_request)
        
        assert response.status_code == 500
        assert "Aggregator not initialized" in str(response.body)
    
    @pytest.mark.asyncio
    async def test_sse_endpoint_no_servers_mounted(self):
        """Test SSE endpoint when no servers are mounted"""
        mock_request = Mock()
        mock_request.headers = {'X-Client-ID': 'test-client'}
        mock_request.method = "GET"
        
        # Create mock aggregator with no mounted servers
        mock_aggregator = Mock()
        mock_aggregator.get_status.return_value = {
            'mounted_servers': [],
            'running_servers': [],
            'failed_servers': []
        }
        
        aggregator_module.aggregator = mock_aggregator
        
        response = await sse_endpoint(mock_request)
        
        assert response.status_code == 503
        assert "No servers available" in str(response.body)
    
    @pytest.mark.asyncio
    async def test_sse_endpoint_post_method(self):
        """Test SSE endpoint with POST method"""
        mock_request = AsyncMock()
        mock_request.headers = {'X-Client-ID': 'test-client'}
        mock_request.method = "POST"
        mock_request.body.return_value = b'{"test": "data"}'
        
        # Create mock aggregator
        mock_aggregator = Mock()
        mock_aggregator.workspace_name = "test-workspace"
        mock_aggregator.mounted_servers = ['server1']
        mock_aggregator.get_status.return_value = {
            'mounted_servers': ['server1'],
            'running_servers': ['server1'],
            'failed_servers': []
        }
        
        aggregator_module.aggregator = mock_aggregator
        
        # Mock EventSourceResponse
        with patch('aggregator.EventSourceResponse') as mock_ess:
            mock_response = Mock()
            mock_ess.return_value = mock_response
            
            response = await sse_endpoint(mock_request)
            
            assert response == mock_response
            mock_ess.assert_called_once()


class TestStartupShutdown:
    """Test suite for startup and shutdown functions"""
    
    @pytest.mark.asyncio
    async def test_startup_success(self, sample_config):
        """Test successful startup"""
        # Mock environment variable
        with patch.dict(os.environ, {'WORKSPACE_CONFIG': json.dumps(sample_config)}):
            # Mock MCPAggregator
            with patch('aggregator.MCPAggregator') as mock_aggregator_class:
                mock_aggregator = AsyncMock()
                mock_aggregator.mounted_servers = ['server1']
                mock_aggregator.servers = ['server1']
                mock_aggregator.workspace_name = 'test-workspace'
                mock_aggregator_class.return_value = mock_aggregator
                
                # Mock health_server
                with patch('aggregator.health_server') as mock_health_server:
                    with patch('aggregator.health_monitor') as mock_health_monitor:
                        await startup()
                        
                        # Verify aggregator was initialized
                        mock_aggregator.initialize.assert_called_once()
                        
                        # Verify health monitor was set to ready
                        mock_health_monitor.set_ready.assert_called_with(True)
    
    @pytest.mark.asyncio
    async def test_startup_missing_config(self):
        """Test startup with missing configuration"""
        # Clear environment variable
        with patch.dict(os.environ, {}, clear=True):
            with patch('sys.exit') as mock_exit:
                await startup()
                mock_exit.assert_called_with(1)
    
    @pytest.mark.asyncio
    async def test_startup_invalid_json(self):
        """Test startup with invalid JSON configuration"""
        with patch.dict(os.environ, {'WORKSPACE_CONFIG': 'invalid json'}):
            with patch('sys.exit') as mock_exit:
                await startup()
                mock_exit.assert_called_with(1)
    
    @pytest.mark.asyncio
    async def test_shutdown_with_aggregator(self):
        """Test shutdown with aggregator initialized"""
        mock_aggregator = AsyncMock()
        aggregator_module.aggregator = mock_aggregator
        
        await shutdown()
        
        mock_aggregator.shutdown.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_shutdown_without_aggregator(self):
        """Test shutdown without aggregator"""
        aggregator_module.aggregator = None
        
        # Should not raise any exceptions
        await shutdown()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])