# MCP SSE Test Suite

This test suite validates the SSE endpoint functionality of the MCP Hub using smolagents.

## Components

1. **`simple_mcp_server.py`** - A basic MCP server with test tools and prompts
2. **`test_sse_client.py`** - A smolagent client that connects via SSE 
3. **`setup_test.py`** - Script to configure the test server in yamcp-ui
4. **`requirements.txt`** - Python dependencies

## Test Architecture

```
smolagent client → SSE endpoint (/mcp/test-workspace) → yamcp run test-workspace → simple_mcp_server.py
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Make sure the Docker container is running:**
   ```bash
   docker-compose up -d
   ```

3. **Setup the test server configuration:**
   ```bash
   python setup_test.py
   ```

4. **Test the SSE endpoint directly:**
   ```bash
   curl -N http://localhost:8765/mcp/test-workspace
   ```

5. **Run the smolagent test:**
   ```bash
   python test_sse_client.py
   ```

## Expected Behavior

- The SSE endpoint should stream output from the MCP server
- The smolagent should be able to interact with MCP tools via SSE
- Process cleanup should work when connections are closed

## Troubleshooting

- Check Docker logs: `docker-compose logs -f yamcp-ui`
- Verify config files exist in container: `docker exec yamcp-ui-dev ls -la /root/.local/share/yamcp-nodejs/`
- Test API endpoints: `curl http://localhost:8765/api/workspaces`