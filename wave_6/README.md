# Wave 6: Real MCP Server Composition with SmolAgents

## Overview

Wave 6 demonstrates the integration of real MCP servers using FastMCP's composition features, tested with Hugging Face's SmolAgents library. This implementation proves that we can compose multiple MCP servers (perplexity-mcp and sequential-thinking) into a single workspace and interact with them via an AI agent.

## Prerequisites

- Python 3.10+ (required by FastMCP)
- Node.js and npm (for npx to install MCP servers)
- Perplexity API key (set in .env file)

## Installation

1. Create a `.env` file in the `wave_6/` directory:
```bash
# wave_6/.env
PERPLEXITY_API_KEY=your-api-key-here
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. The MCP servers will be automatically installed via npx when the server starts:
   - `perplexity-mcp` - Web search capabilities
   - `@modelcontextprotocol/server-sequential-thinking` - Step-by-step reasoning

## Architecture

```
SmolAgents Client (wave_6_agent_test.py)
    ↓ SSE Transport
FastMCP Workspace Server (wave_6_compose_test.py)
    ├── Perplexity MCP Server (subprocess via npx)
    └── Sequential Thinking MCP Server (subprocess via npx)
```

## Files

- `wave_6_compose_test.py` - FastMCP server that composes real MCP servers
- `wave_6_agent_test.py` - SmolAgents test client connecting via SSE
- `wave_6_implementation.md` - Detailed technical documentation
- `requirements.txt` - Python dependencies with version constraints
- `README.md` - This file

## Usage

### Step 1: Start the Composed MCP Server

In one terminal:
```bash
cd wave_6/implementation
python wave_6_compose_test.py
```

You should see:
```
Creating workspace with real MCP servers...

✓ Workspace created with mounted servers:
  - perplexity (search capabilities)
  - sequential-thinking (reasoning capabilities)

Starting SSE server on http://localhost:8000/sse

Tools will be prefixed with server names:
  - perplexity_*
  - sequential_*
```

### Step 2: Run the SmolAgents Test Client

In another terminal:
```bash
cd wave_6/implementation
python wave_6_agent_test.py
```

The client will:
1. Connect to the workspace via SSE
2. List all available tools from both MCP servers
3. Run three test queries demonstrating:
   - Perplexity search capabilities
   - Sequential thinking reasoning
   - Combined usage of both servers

## Key Features Demonstrated

1. **FastMCP Config Proxy**: Using `FastMCP.as_proxy()` with a config dictionary to create a workspace
2. **Real MCP Server Integration**: Spawning actual MCP servers as subprocesses via npx
3. **SmolAgents MCP Support**: Using `MCPClient` with SSE transport to connect to MCP servers
4. **Tool Composition**: Tools from multiple servers accessible with prefixed names

## Technical Details

### FastMCP Version Requirements
- Requires FastMCP ≥ 2.7.0 for `as_proxy()` with config dict support
- Latest version (2.9.0) includes MCP protocol updates from June 2025

### SmolAgents Version Requirements
- Requires smolagents ≥ 1.19.0 for MCP integration
- Uses `ToolCollection.from_mcp()` for loading tools from MCP servers

### MCP Server Configuration
```python
WORKSPACE_CONFIG = {
    "mcpServers": {
        "perplexity": {
            "command": "npx",
            "args": ["-y", "perplexity-mcp"],
            "env": {"PERPLEXITY_API_KEY": os.getenv("PERPLEXITY_API_KEY")}
        },
        "sequential-thinking": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
        }
    }
}
```

The Perplexity API key is loaded from the `.env` file for security.

## Troubleshooting

1. **Port already in use**: If port 8000 is busy, modify the port in `wave_6_compose_test.py`
2. **npx not found**: Ensure Node.js is installed and npx is in your PATH
3. **Module not found**: Run `pip install -r requirements.txt` to install dependencies
4. **Connection refused**: Ensure the server is running before starting the client

## Next Steps

This pattern can be integrated into the main dev_server.py to replace dummy tools with real MCP servers:

1. Use `FastMCP.as_proxy(config)` instead of creating dummy tools
2. Handle server lifecycle management for workspace deletion
3. Add error handling for server startup failures
4. Consider caching subprocess connections for performance

## References

- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [SmolAgents Documentation](https://github.com/huggingface/smolagents)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [nicknochnack/MCPin10](https://github.com/nicknochnack/MCPin10) - Inspiration for the concise SmolAgents pattern