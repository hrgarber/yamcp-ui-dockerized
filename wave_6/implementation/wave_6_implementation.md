# Wave 6 Implementation: Real MCP Server Composition with SmolAgents

## Overview

Wave 6 demonstrates the integration of real MCP servers (perplexity and sequential-thinking) using FastMCP's composition features, tested with a concise SmolAgents client connecting via SSE transport.

## Architecture

```
┌─────────────────────────────────────────┐
│      wave_6_agent_test.py               │
│  ┌──────────────────────────────────┐   │
│  │  SmolAgents ToolCallingAgent     │   │
│  │  with MCPClient (SSE transport)  │   │
│  └────────────┬─────────────────────┘   │
│               │ SSE                      │
└───────────────┼─────────────────────────┘
                │
                ▼ http://localhost:8000/sse
┌─────────────────────────────────────────┐
│      wave_6_compose_test.py             │
│  ┌──────────────────────────────────┐   │
│  │  FastMCP Workspace Server (SSE)  │   │
│  │  Composed with real MCP servers  │   │
│  └────────────┬─────────────────────┘   │
│               │ mounts                   │
│    ┌──────────┴──────────┐              │
│    │                     │              │
│  ┌─▼─────────┐  ┌───────▼──────┐       │
│  │ Perplexity│  │ Sequential   │       │
│  │ Proxy     │  │ Thinking     │       │
│  └─────┬─────┘  └──────┬───────┘       │
│        │               │                │
└────────┼───────────────┼────────────────┘
         │               │
    ┌────▼──────┐  ┌────▼──────┐
    │ npx       │  │ npx       │
    │ perplexity│  │ @modelcon │
    │ -mcp      │  │ textproto │
    └───────────┘  └───────────┘
```

## Key Components

### 1. wave_6_compose_test.py
- Uses FastMCP's `as_proxy()` to create a workspace from a config dict
- Config format matches the UI's expected structure
- Spawns real MCP servers via npx subprocesses
- Exposes composed workspace via SSE on port 8000

### 2. wave_6_agent_test.py
- Based on nicknochnack/MCPin10 concise pattern
- Uses SmolAgents' `ToolCallingAgent` with `MCPClient`
- Connects to the workspace via SSE transport
- Runs test queries demonstrating both servers' capabilities

### 3. wave_6_test_all.py (optional)
- Convenience script that starts server and runs tests
- Handles cleanup automatically

## Configuration

### MCP Servers
```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "perplexity-mcp"],
      "env": {
        "PERPLEXITY_API_KEY": "pplx-xxx"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

### Key Insights from Research

1. **FastMCP Config Proxy**: FastMCP can create a proxy directly from a config dict that matches the MCPConfig schema
2. **Subprocess Management**: FastMCP handles spawning npx processes internally when using config-based proxies
3. **Tool Prefixing**: Tools from mounted servers are automatically prefixed with server names
4. **SSE Transport**: Recommended for easy testing and browser-based debugging
5. **SmolAgents MCPClient**: Supports both stdio and HTTP-based transports seamlessly

## Testing Process

### Manual Testing
1. Start the server:
   ```bash
   python wave_6_compose_test.py
   ```

2. In another terminal, run the client:
   ```bash
   python wave_6_agent_test.py
   ```

### Automated Testing
```bash
python wave_6_test_all.py
```

## Expected Outputs

### Server Output
```
Creating workspace with real MCP servers...

✓ Workspace created with mounted servers:
  - perplexity (search capabilities)
  - sequential-thinking (reasoning capabilities)

Starting SSE server on http://localhost:8000/sse

Tools will be prefixed with server names:
  - perplexity_*
  - sequential_*

Press Ctrl+C to stop the server
```

### Client Output
```
Connecting to composed MCP workspace via SSE...

Available MCP tools:
  - perplexity_search: Search the web for information
  - sequential_think: Think through problems step by step
  ...

Test 1: Testing Perplexity search capabilities
Result: [Actual search results about FastMCP]

Test 2: Testing Sequential thinking capabilities
Result: [Step-by-step plan for Python web development]

Test 3: Testing combined capabilities
Result: [Research results + structured plan]
```

## Integration Path

Once validated, this pattern can be integrated into dev_server.py:

1. **Replace dummy tools** with real server composition:
   ```python
   def create_workspace_instance(name: str, config: dict) -> FastMCP:
       # Use FastMCP.as_proxy(config) instead of creating dummy tools
       workspace = FastMCP.as_proxy(
           {"mcpServers": config.get("servers", {})},
           name=f"Workspace-{name}"
       )
       return workspace
   ```

2. **Update mount logic** in the API endpoint:
   ```python
   @app.post("/api/workspaces/{name}")
   async def create_workspace(name: str, config: WorkspaceConfig):
       # Create proxy from config
       mcp = create_workspace_instance(name, config.dict())
       
       # Get HTTP app and mount
       workspace_app = mcp.http_app(path='/mcp/v1')
       app.mount(f"/workspace/{name}", workspace_app)
       
       workspaces[name] = mcp
       return format_workspace_response(name)
   ```

3. **Add error handling** for server startup failures
4. **Consider subprocess lifecycle** management

## Benefits

1. **Real functionality**: Actual MCP servers instead of dummy tools
2. **Simple implementation**: Leverages FastMCP's built-in capabilities
3. **Production pattern**: This is how MCP servers are used in real applications
4. **Minimal code**: Both files are concise and focused
5. **Easy testing**: SmolAgents provides clean agent interface

## Next Steps

1. Validate that both MCP servers start correctly
2. Test tool discovery and execution
3. Verify error handling for missing dependencies
4. Document any issues or learnings
5. Plan integration into main dev_server.py