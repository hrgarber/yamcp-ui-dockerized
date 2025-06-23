# Final Proposal: Hybrid "Dumb Manager, Smart Workspace" Architecture

**Date**: 2025-01-23  
**Status**: Proposed Architecture  
**Decision**: Use FastMCP for workspace aggregation

## Executive Summary

After extensive analysis and consensus building, we propose a two-container architecture that cleanly separates configuration (Manager) from execution (Workspace). This approach fulfills the vision of "UI builds JSON, something handles the rest" while using the right tool for each job.

## Architecture Overview

### Container 1: Manager ("Dumb" Configuration Layer)
- **Purpose**: Pure UI/UX for workspace configuration
- **Technology**: YAMCP-UI (React, TypeScript, Express)
- **Responsibilities**:
  - Provide web interface for adding/editing MCP servers
  - Create and manage workspace configurations
  - Store configurations as JSON
  - Orchestrate Docker to create/destroy workspace containers
- **Key Constraint**: NO MCP protocol logic whatsoever

### Container 2: Workspace ("Smart" Execution Layer)
- **Purpose**: Run MCP servers and provide unified access
- **Technology**: FastMCP (Python) for aggregation
- **Responsibilities**:
  - Receive JSON configuration on startup
  - Mount all configured MCP servers via FastMCP
  - Handle stdio-to-HTTP protocol conversion
  - Expose single aggregated endpoint
  - Manage server lifecycle and health

## The JSON Handoff

When a user clicks "Publish" in the UI:

```json
{
  "workspace_name": "dev-environment",
  "servers": [
    {
      "name": "context7",
      "command": "mcp-server-context7",
      "args": []
    },
    {
      "name": "github",
      "command": "mcp-server-github",
      "args": ["--repo", "user/repo"]
    },
    {
      "name": "filesystem",
      "command": "mcp-server-filesystem",
      "args": ["/workspace"]
    }
  ],
  "port": 8765
}
```

The Manager creates a new container with this JSON as environment configuration.

## Workspace Container Implementation

```python
# workspace_aggregator.py
from fastmcp import FastMCP
import json
import os
import asyncio

# Load configuration from environment
config = json.loads(os.environ['WORKSPACE_CONFIG'])
app = FastMCP(name=config['workspace_name'])

async def start_servers():
    for server in config['servers']:
        # Create stdio subprocess for each MCP server
        process = await asyncio.create_subprocess_exec(
            server['command'],
            *server['args'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE
        )
        
        # Mount it in FastMCP
        app.mount(f"/{server['name']}", process)

# Start aggregation
if __name__ == "__main__":
    asyncio.run(start_servers())
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config['port'])
```

## Benefits of This Approach

1. **Clean Separation of Concerns**
   - Manager focuses purely on UX and configuration
   - Workspace handles all technical MCP complexity

2. **Resource Efficiency**
   - Single Python process per workspace (vs N+1 Node processes)
   - Lower memory footprint
   - Better performance

3. **Native Aggregation**
   - FastMCP designed specifically for multi-server aggregation
   - Handles tool conflicts automatically
   - Built-in routing and protocol handling

4. **Simple Implementation**
   - No custom aggregation logic to build
   - FastMCP's `mount()` API is straightforward
   - Estimated 2-3 days to implement

5. **Flexibility**
   - Easy to add new MCP servers
   - Can swap FastMCP for other solutions later
   - Workspace containers are stateless and disposable

## Implementation Timeline

### Phase 1: Workspace Runtime (1-2 days)
- Create Dockerfile with Python and FastMCP
- Implement workspace_aggregator.py
- Test with 2-3 MCP servers
- Verify aggregation and routing

### Phase 2: Manager Integration (1-2 days)
- Add publish/unpublish API endpoints
- Implement Docker container orchestration
- Create environment variable injection
- Add health monitoring

### Phase 3: UI Enhancement (1 day)
- Add "Publish" button to workspace cards
- Show workspace status (configured/running)
- Display assigned ports
- Add stop/restart controls

## Addressing Concerns

### "Why not SuperGateway?"
SuperGateway excels at protocol conversion but lacks native aggregation. Using it would require:
- Multiple SuperGateway instances (one per server)
- Custom aggregation layer
- Complex port and process management
- Higher resource usage

### "Why Python/FastMCP?"
- Purpose-built for MCP aggregation
- Single process simplicity
- Well-documented mount() API
- Active development and MCP compliance

### "What about YAMCP?"
While YAMCP provides aggregation, it's tightly coupled with its CLI interface and has Docker/ES module challenges. FastMCP gives us just the aggregation piece we need.

## Success Criteria

1. ✅ Manager can create workspace containers via Docker API
2. ✅ Each workspace exposes single aggregated endpoint
3. ✅ Tool discovery shows all servers in workspace
4. ✅ Workspaces are isolated and independently manageable
5. ✅ UI remains focused on configuration only

## Conclusion

This architecture delivers on the core vision: the UI builds JSON configurations, and FastMCP handles all the MCP complexity. It's simpler than the SuperGateway approach, more focused than using full YAMCP, and maintains the clean separation between configuration and execution.

The "Dumb Manager, Smart Workspace" pattern ensures each component does one thing well, making the system easier to understand, debug, and extend.