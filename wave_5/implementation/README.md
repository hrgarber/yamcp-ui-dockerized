# FastMCP Dev Server Implementation

This is an implementation of the FastMCP Dev Server as described in the Wave 5 documentation.

## Overview

This development server provides a simple way to manage FastMCP workspaces. It offers:

- REST API for workspace management
- CLI interface for common operations
- In-memory workspace storage (resets on restart)
- Integration with the existing React UI

## Getting Started

### Installation

```bash
# Install dependencies
pip install fastapi fastmcp uvicorn typer

# Make the script executable
chmod +x dev_server.py
```

### Running the Server

```bash
# Start the server
python dev_server.py serve

# The server will run at:
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### Using the CLI

```bash
# Create a workspace
python dev_server.py create my-workspace

# Create a workspace with a config file
python dev_server.py create my-workspace --config-file workspace.json

# List workspaces
python dev_server.py list
```

### Using the API

```bash
# Create a workspace
curl -X POST http://localhost:8000/api/workspaces/dev \
  -H "Content-Type: application/json" \
  -d '{"name": "dev", "servers": {"github": {"command": "mcp-server-github", "args": []}}}'

# List workspaces
curl http://localhost:8000/api/workspaces

# Delete a workspace
curl -X DELETE http://localhost:8000/api/workspaces/dev
```

## Connecting with the UI

1. Start the dev server: `python dev_server.py serve`
2. Start the React UI (from the project root): `npm run dev`
3. The UI should connect to the server at http://localhost:8000

## Limitations

This is a development environment with the following limitations:

- No persistence (workspaces reset when the server restarts)
- Maximum of 5 workspaces
- No real MCP server process spawning (uses in-memory tools)
- No authentication or advanced error handling

## Next Steps

1. Implement real MCP server mounting via FastMCP
2. Add configuration validation
3. Enhance error handling