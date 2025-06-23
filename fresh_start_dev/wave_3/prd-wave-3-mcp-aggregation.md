# Product Requirements Document: Wave 3 MCP Workspace Aggregation

**Version**: 1.0  
**Date**: 2025-01-23  
**Status**: Draft

## 1. Introduction/Overview

Wave 3 implements the "Dumb Manager, Smart Workspace" architecture to solve the core problem of MCP workspace aggregation. This system enables multiple MCP servers to be presented as a single, unified endpoint through containerized FastMCP aggregation.

The solution transforms YAMCP-UI from a broken single-server spawner into a production-ready workspace aggregation platform where the UI simply builds JSON configuration and FastMCP handles all the complexity.

## 2. Goals

### Primary Goals
1. **Enable Workspace Aggregation**: Present multiple MCP servers as a single unified endpoint accessible via HTTP/SSE
2. **Simplify Architecture**: Move aggregation complexity from UI to dedicated Python/FastMCP containers
3. **Ensure Isolation**: Run each workspace in its own Docker container for security and resource management
4. **Maintain Simplicity**: "UI builds JSON, FastMCP handles the rest" philosophy

### Measurable Success Criteria
- Support 10+ concurrent workspaces without performance degradation
- Aggregate 5+ MCP servers per workspace with <100ms overhead
- Achieve 99% uptime for running workspaces
- Complete implementation in 2-3 days

## 3. User Stories

### For Developers Configuring Workspaces
- As a developer, I want to configure multiple MCP servers in a workspace through the UI so that I can access them all through a single endpoint
- As a developer, I want to see the status of my workspaces so that I know when they're ready to use
- As a developer, I want to update workspace configuration without losing my work so that I can iterate quickly

### For AI Agents/Clients
- As an AI client, I want to discover all tools from all servers in a workspace through a single endpoint so that I can use them seamlessly
- As an AI client, I want tool calls to be automatically routed to the correct server so that I don't need to know the internal structure
- As an AI client, I want consistent error messages when things go wrong so that I can handle failures gracefully

### For System Administrators
- As an admin, I want workspaces to run in isolated containers so that one workspace can't affect others
- As an admin, I want to monitor resource usage per workspace so that I can manage system capacity
- As an admin, I want failed containers to be automatically restarted so that the system is self-healing

## 4. Functional Requirements

### 4.1 Manager Service (Node.js)
1. **Container Lifecycle Management**
   - Start workspace containers on demand
   - Stop containers after configurable idle timeout
   - Restart failed containers automatically
   - Clean up orphaned containers on startup

2. **Configuration Management**
   - Accept workspace configuration as JSON from UI
   - Convert configuration to environment variables for containers
   - Validate configuration before container creation
   - Store active workspace configurations

3. **Port Management**
   - Allocate unique ports for each workspace
   - Track port assignments in persistent storage
   - Release ports when workspaces are deleted
   - Provide port information to UI for display

4. **Health Monitoring**
   - Check container health every 30 seconds
   - Expose workspace status endpoint for UI
   - Track container restart count
   - Alert on repeated failures (log only in v1)

### 4.2 Workspace Runtime (Python/FastMCP)
1. **MCP Aggregation**
   - Initialize FastMCP hub from environment configuration
   - Mount each configured MCP server with namespace prefix
   - Handle server initialization failures gracefully
   - Provide aggregated tool discovery

2. **SSE Endpoint**
   - Expose FastMCP hub via SSE transport on port 8080
   - Handle client connections and disconnections
   - Implement request/response correlation
   - Support concurrent client connections

3. **Health Endpoints**
   - `/health` - Basic liveness check
   - `/ready` - Confirms all servers initialized
   - `/status` - Detailed server status information
   - `/metrics` - Basic performance metrics (request count, latency)

4. **Error Handling**
   - Graceful degradation when individual servers fail
   - Clear error messages in MCP protocol format
   - Timeout handling for unresponsive servers
   - Structured logging for debugging

### 4.3 UI Integration
1. **Workspace Management**
   - "Publish" button to create/update workspace container
   - Status indicators (starting, running, error, stopped)
   - Display assigned port and connection URL
   - Delete workspace functionality

2. **Configuration Display**
   - Show current running configuration
   - Indicate when configuration differs from running state
   - Validate configuration before publish
   - Provide configuration templates

## 5. Non-Goals (Out of Scope)

### Not in Wave 3
1. **Multi-tenant Security**: No user authentication or workspace isolation between users
2. **Workspace Sharing**: No ability to share workspaces between users
3. **Advanced Monitoring**: No metrics dashboards or alerting systems
4. **Configuration History**: No versioning or rollback of configurations
5. **Custom MCP Servers**: No support for developing custom MCP servers
6. **High Availability**: No multi-node deployment or failover
7. **Backup/Restore**: No workspace state persistence

## 6. Design Considerations

### Architecture Decisions
- **Dumb Manager**: Node.js service only handles Docker orchestration, no MCP logic
- **Smart Workspace**: All MCP aggregation logic contained in Python/FastMCP containers
- **Single Process**: One Python process per workspace for resource efficiency
- **JSON Contract**: Clean interface between UI and backend via JSON configuration

### Security Considerations
- Containers run with minimal privileges
- No host filesystem access except for configuration
- Network isolation between workspace containers
- No secrets stored in environment variables (future: secret management)

## 7. Technical Considerations

### Container Requirements
- **Base Image**: Python 3.11+ with FastMCP pre-installed
- **Resource Limits**: 512MB RAM, 0.5 CPU per workspace (configurable)
- **Networking**: Bridge network with published SSE port
- **Storage**: Ephemeral only, no persistent volumes

### Configuration Schema
```json
{
  "workspace": {
    "name": "my-workspace",
    "servers": [
      {
        "name": "github",
        "command": "mcp-server-github",
        "args": ["--token", "${GITHUB_TOKEN}"]
      },
      {
        "name": "filesystem",
        "command": "mcp-server-filesystem",
        "args": ["--root", "/allowed/path"]
      }
    ]
  }
}
```

### Error Response Format
All errors follow MCP JSON-RPC error format:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "server": "github",
      "details": "Failed to initialize"
    }
  },
  "id": 1
}
```

## 8. Success Metrics

### Implementation Success
- [ ] Manager service creates and manages containers
- [ ] Workspace runtime aggregates multiple servers
- [ ] UI can publish and monitor workspaces
- [ ] Smolagents can connect and use all tools
- [ ] Resource usage under 512MB per workspace

### Performance Metrics
- Container startup time < 5 seconds
- Tool discovery latency < 500ms
- Tool execution overhead < 100ms
- Support 10+ concurrent workspaces

### Reliability Metrics
- Automatic recovery from container failures
- No workspace affecting another
- Clean shutdown and restart
- Proper error propagation to clients

## 9. Open Questions

### For Later Phases
1. **Authentication**: How will we add multi-user support in the future?
2. **Persistence**: Should workspace configurations be backed up?
3. **Scaling**: How do we handle 100+ workspaces?
4. **Monitoring**: What observability tools should we integrate?

### For Implementation
1. **Idle Timeout**: What's the optimal timeout before stopping unused workspaces?
2. **Restart Policy**: How many times should we retry failed containers?
3. **Port Range**: What port range should we allocate for workspaces?
4. **Log Retention**: How long should we keep container logs?

## Appendix: Implementation Timeline

### Day 1: Workspace Runtime
- Set up Python/FastMCP development environment
- Create workspace Docker image
- Implement basic aggregation script
- Test with multiple MCP servers

### Day 2: Manager Service
- Implement Docker orchestration logic
- Add configuration management
- Create health monitoring
- Integrate with existing Express server

### Day 3: Integration & Polish
- Connect UI to manager endpoints
- Add status indicators
- Implement error handling
- End-to-end testing

---

This PRD provides clear requirements for implementing Wave 3's MCP workspace aggregation while maintaining focus on the core value proposition: making multiple MCP servers accessible through a single, unified endpoint.