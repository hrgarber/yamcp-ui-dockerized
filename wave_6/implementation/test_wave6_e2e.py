#!/usr/bin/env python3
"""
Simple end-to-end tests for Wave 6 MCP Server Composition
Tests basic server behavior and functionality
"""
import pytest
import subprocess
import time
import requests
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

@pytest.fixture(scope="module")
def server_process():
    """Start the Wave 6 server as a subprocess"""
    server_path = Path(__file__).parent / "wave_6_compose_test.py"
    process = subprocess.Popen(
        [sys.executable, "-u", str(server_path)],  # -u for unbuffered output
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, "PYTHONUNBUFFERED": "1"}  # Force unbuffered
    )
    
    # Wait for server to actually start by checking the endpoint
    max_wait = 30  # seconds
    start_time = time.time()
    server_ready = False
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get("http://localhost:8000/sse", timeout=1, stream=True)
            if response.status_code == 200:
                server_ready = True
                break
        except:
            pass
        time.sleep(0.5)
    
    if not server_ready:
        process.terminate()
        pytest.fail("Server did not start within 30 seconds")
    
    yield process
    
    # Cleanup
    process.terminate()
    process.wait(timeout=5)


def test_server_starts_without_crashing(server_process):
    """Test 1: Server process starts and doesn't immediately crash"""
    # Check if process is still running
    assert server_process.poll() is None, "Server process crashed on startup"
    
    # Read some output to see if it started
    output_lines = []
    for _ in range(10):
        line = server_process.stdout.readline()
        if line:
            output_lines.append(line.strip())
    
    # Should see some startup messages
    output_text = "\n".join(output_lines)
    assert "Creating workspace" in output_text or "Workspace created" in output_text, f"No workspace creation message found in: {output_text}"


def test_sse_endpoint_is_accessible():
    """Test 2: SSE endpoint responds to HTTP requests"""
    # Try to connect to the SSE endpoint
    try:
        response = requests.get("http://localhost:8000/sse", timeout=5, stream=True)
        assert response.status_code == 200, f"SSE endpoint returned {response.status_code}"
        content_type = response.headers.get('Content-Type', '')
        assert content_type.startswith('text/event-stream'), f"Wrong content type for SSE: {content_type}"
    except requests.exceptions.ConnectionError:
        pytest.fail("Could not connect to SSE endpoint at http://localhost:8000/sse")
    except requests.exceptions.Timeout:
        pytest.fail("SSE endpoint timed out")


def test_server_composed_multiple_providers(server_process):
    """Test 3: Server output shows it composed multiple MCP providers"""
    # Read more output to check for both servers
    output_lines = []
    for _ in range(20):
        line = server_process.stdout.readline()
        if line:
            output_lines.append(line.strip())
    
    output_text = "\n".join(output_lines)
    
    # Check that both servers are mentioned
    assert "perplexity" in output_text.lower(), f"Perplexity server not mentioned in output: {output_text}"
    assert "sequential-thinking" in output_text.lower(), f"Sequential thinking server not mentioned in output: {output_text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])