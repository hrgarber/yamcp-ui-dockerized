# Tasks for Wave 3 MCP Workspace Aggregation

Generated from: prd-wave-3-mcp-aggregation.md  
Date: 2025-01-23

## Relevant Files

### Workspace Runtime (Python/FastMCP)
- `fresh_start_dev/wave_3/workspace/Dockerfile` - Container image for FastMCP runtime
- `fresh_start_dev/wave_3/workspace/requirements.txt` - Python dependencies including FastMCP
- `fresh_start_dev/wave_3/workspace/aggregator.py` - Main FastMCP aggregation script
- `fresh_start_dev/wave_3/workspace/test_aggregator.py` - Unit tests for aggregator
- `fresh_start_dev/wave_3/workspace/health_server.py` - Health check endpoints
- `fresh_start_dev/wave_3/workspace/test_health_server.py` - Unit tests for health endpoints

### Manager Service (Node.js)
- `fresh_start_dev/wave_3/manager/index.js` - Main manager service entry point
- `fresh_start_dev/wave_3/manager/index.test.js` - Unit tests for manager service
- `fresh_start_dev/wave_3/manager/docker-client.js` - Docker container orchestration
- `fresh_start_dev/wave_3/manager/docker-client.test.js` - Unit tests for Docker client
- `fresh_start_dev/wave_3/manager/config-validator.js` - Workspace configuration validation
- `fresh_start_dev/wave_3/manager/config-validator.test.js` - Unit tests for config validation
- `fresh_start_dev/wave_3/manager/port-manager.js` - Port allocation and tracking
- `fresh_start_dev/wave_3/manager/port-manager.test.js` - Unit tests for port management
- `fresh_start_dev/wave_3/manager/health-monitor.js` - Container health monitoring
- `fresh_start_dev/wave_3/manager/health-monitor.test.js` - Unit tests for health monitoring

### Shared Contracts
- `fresh_start_dev/wave_3/shared/workspace-config.schema.json` - JSON schema for workspace configuration
- `fresh_start_dev/wave_3/shared/error-codes.js` - Standardized error codes and messages
- `fresh_start_dev/wave_3/shared/types.d.ts` - TypeScript type definitions

### UI Integration
- `src/components/WorkspacePublish.tsx` - Publish button component
- `src/components/WorkspacePublish.test.tsx` - Unit tests for publish component
- `src/components/WorkspaceStatus.tsx` - Status indicator component
- `src/components/WorkspaceStatus.test.tsx` - Unit tests for status component
- `src/services/workspace-manager.ts` - API client for manager service
- `src/services/workspace-manager.test.ts` - Unit tests for API client
- `server.js` - Update existing Express server with new endpoints

### Integration Tests
- `fresh_start_dev/wave_3/tests/e2e/workspace-lifecycle.test.js` - End-to-end workspace tests
- `fresh_start_dev/wave_3/tests/integration/mcp-aggregation.test.js` - MCP aggregation tests
- `fresh_start_dev/wave_3/tests/docker-compose.test.yml` - Test environment configuration

### Notes

- Unit tests should be placed alongside code files
- Use `pytest` for Python tests
- Use `jest` for JavaScript/TypeScript tests
- Integration tests require Docker environment

## Tasks

- [ ] 1.0 Set up Workspace Runtime infrastructure (Python/FastMCP container)
  - [ ] 1.1 Create workspace directory structure and Python environment
  - [ ] 1.2 Write Dockerfile with Python 3.11+ and FastMCP installation
  - [ ] 1.3 Create requirements.txt with pinned FastMCP version and dependencies
  - [ ] 1.4 Implement aggregator.py with FastMCP hub initialization from environment
  - [ ] 1.5 Add dynamic server mounting based on JSON configuration
  - [ ] 1.6 Implement SSE endpoint exposure on port 8080
  - [ ] 1.7 Create health_server.py with /health, /ready, /status, /metrics endpoints
  - [ ] 1.8 Add graceful error handling for server initialization failures
  - [ ] 1.9 Implement structured logging for debugging
  - [ ] 1.10 Write unit tests for aggregator and health endpoints

- [ ] 2.0 Implement Manager Service (Node.js Docker orchestration)
  - [ ] 2.1 Create manager directory structure and package.json
  - [ ] 2.2 Implement docker-client.js for container lifecycle management
  - [ ] 2.3 Add container start/stop/restart functionality with error handling
  - [ ] 2.4 Create config-validator.js to validate workspace JSON configuration
  - [ ] 2.5 Implement configuration to environment variable conversion
  - [ ] 2.6 Create port-manager.js for unique port allocation and tracking
  - [ ] 2.7 Add persistent storage for port assignments
  - [ ] 2.8 Implement health-monitor.js for 30-second container health checks
  - [ ] 2.9 Add automatic container restart on failure with backoff
  - [ ] 2.10 Create manager API endpoints for UI integration
  - [ ] 2.11 Add orphaned container cleanup on startup
  - [ ] 2.12 Write comprehensive unit tests for all manager components

- [ ] 3.0 Create shared contracts and interfaces
  - [ ] 3.1 Define workspace-config.schema.json with full validation rules
  - [ ] 3.2 Create error-codes.js with MCP-compliant error formats
  - [ ] 3.3 Write TypeScript type definitions for all shared interfaces
  - [ ] 3.4 Document JSON configuration examples and edge cases
  - [ ] 3.5 Create validation test suite for configuration schema

- [ ] 4.0 Integrate UI with Manager Service endpoints
  - [ ] 4.1 Create WorkspacePublish component with loading states
  - [ ] 4.2 Implement WorkspaceStatus component with real-time updates
  - [ ] 4.3 Create workspace-manager.ts API client service
  - [ ] 4.4 Add publish functionality to create/update workspace containers
  - [ ] 4.5 Implement status polling for workspace state updates
  - [ ] 4.6 Add delete workspace functionality with confirmation
  - [ ] 4.7 Display assigned port and connection URL in UI
  - [ ] 4.8 Show configuration diff when running state differs
  - [ ] 4.9 Update Express server.js with manager proxy endpoints
  - [ ] 4.10 Add configuration validation before publish
  - [ ] 4.11 Write unit tests for all UI components and services

- [ ] 5.0 Add end-to-end testing and validation
  - [ ] 5.1 Create docker-compose.test.yml for test environment
  - [ ] 5.2 Write workspace lifecycle tests (create, update, delete)
  - [ ] 5.3 Test MCP aggregation with multiple server types
  - [ ] 5.4 Validate tool discovery shows all servers with prefixes
  - [ ] 5.5 Test error scenarios (server failure, invalid config)
  - [ ] 5.6 Verify resource limits are enforced (512MB RAM, 0.5 CPU)
  - [ ] 5.7 Test concurrent workspace operations
  - [ ] 5.8 Validate health monitoring and auto-restart
  - [ ] 5.9 Test with smolagents client for real MCP validation
  - [ ] 5.10 Document manual testing procedures

## Implementation Order

1. Start with Workspace Runtime (Task 1.0) - Core aggregation logic
2. Then Manager Service (Task 2.0) - Container orchestration
3. Define shared contracts (Task 3.0) - Ensure compatibility
4. UI Integration (Task 4.0) - User-facing features
5. Complete with testing (Task 5.0) - Validation and quality

## Success Criteria Checklist

- [ ] Multiple MCP servers aggregate into single endpoint
- [ ] Each workspace runs in isolated container
- [ ] UI can create/update/delete workspaces
- [ ] Container startup time < 5 seconds
- [ ] Tool discovery latency < 500ms
- [ ] Automatic recovery from failures
- [ ] Resource usage under 512MB per workspace
- [ ] 10+ concurrent workspaces supported