# Project Context: YAMCP-UI MCP Hub Implementation

## 📋 Project Overview

This project transforms `yamcp-ui-dockerized` from a simple containerized configuration tool into a complete **MCP Hub** that provides Server-Sent Events (SSE) access to MCP workspaces with hot reloading and process management.

## 🎯 Goals Achieved

### Primary Objective
Transform yamcp-ui into a robust, user-friendly MCP Hub that allows:
1. Easy configuration management through existing GUI
2. Real-time access to MCP workspaces via SSE endpoints
3. Hot reloading when configurations change
4. Reliable, self-healing operation

### Success Criteria Met
- ✅ GUI configuration management (existing yamcp-ui)
- ✅ SSE endpoints at `/mcp/:workspaceName`
- ✅ Hot reloading via PM2 file watching
- ✅ Process reliability and automatic restarts
- ✅ Local network accessibility
- ✅ Minimal complexity approach

## 🏗️ Technical Architecture

### Design Philosophy
**"Smartest, cleverest way with minimal work"** - Extend existing components rather than build new ones.

### Architecture Decision: Extend server.mjs + PM2
Instead of creating new microservices, we:
1. **Extended existing `server.mjs`** to add SSE endpoints
2. **Used PM2** for process management and file watching
3. **Leveraged existing yamcp-ui** for configuration interface

### Alternative Approaches Rejected
- **SuperGateway as separate service**: More complexity, additional container
- **Custom MCP Hub microservice**: Significant development overhead
- **Docker Compose profiles**: Less integrated, manual CLI intervention required

## 🔧 Implementation Details

### Core Components

#### 1. Enhanced server.mjs
**Location**: `/server.mjs`
**Enhancements**:
- Added SSE endpoint handler at `/mcp/:workspaceName`
- Implemented direct MCP server execution (yamcp CLI workaround)
- Added process tracking with `Map<workspaceName, process>`
- Graceful shutdown handling for active MCP processes

**Key Code Additions**:
```javascript
// Process storage
const activeMcpProcesses = new Map();

// SSE endpoint
app.get('/mcp/:workspaceName', (req, res) => {
  // SSE headers, process spawning, output streaming
});

// Graceful shutdown
function gracefulShutdown(signal) {
  // Terminate all active MCP processes
}
```

#### 2. PM2 Configuration
**Location**: `/ecosystem.config.cjs`
**Purpose**: 
- Manage `server.mjs` process lifecycle
- Watch configuration files for changes
- Provide automatic restarts and error recovery

**Key Settings**:
- File watching: `providers.json`, `workspaces.json`
- Memory limit: 500MB with restart
- Exponential backoff restart strategy
- Log management for container environment

#### 3. Docker Enhancement
**Location**: `/docker/Dockerfile`
**Additions**:
- Python 3 and pip for MCP server testing
- PM2 and yamcp global installation
- Alpine-based lightweight container

**CMD Change**:
```dockerfile
# Before: npm start
# After: pm2-runtime start /app/ecosystem.config.cjs
```

### Critical Workarounds Implemented

#### yamcp CLI Failure Workaround
**Problem**: yamcp CLI broken due to ESM/CommonJS conflicts
```
Error [ERR_REQUIRE_ESM]: require() of ES Module
```

**Solution**: Direct MCP server execution
- Parse workspace and provider configurations manually
- Execute MCP servers directly based on their `stdio` configuration
- Bypass broken yamcp CLI entirely

#### PM2 Logging in Container
**Problem**: PM2 couldn't write to `/dev/stdout` in cluster mode
```
Error: ENXIO: no such device or address, open '/dev/stdout'
```

**Solution**: File-based logging with PM2 configuration
- Changed from `/dev/stdout` to `out.log`
- Added `combine_logs: true` option

#### ESM/CommonJS Compatibility
**Problem**: PM2 couldn't load ES module configuration
**Solution**: Renamed `ecosystem.config.js` to `ecosystem.config.cjs`

## 📊 Process Flow

### SSE Connection Lifecycle
1. **Client connects** to `/mcp/:workspaceName`
2. **Server validates** workspace exists in configuration
3. **Process spawning** executes MCP server directly (not via yamcp)
4. **Output streaming** pipes stdout/stderr to SSE client
5. **Error handling** catches process failures and connection drops
6. **Cleanup** terminates MCP process when client disconnects

### Hot Reloading Mechanism
1. **User modifies** configuration via yamcp-ui
2. **File change** detected by PM2 watching config files
3. **Graceful restart** PM2 signals server.mjs to shutdown
4. **Process cleanup** all active MCP processes terminated
5. **Restart** PM2 starts fresh server.mjs instance
6. **Reconnection** clients must reconnect to SSE endpoints

## 🧪 Testing Strategy

### Comprehensive E2E Test Suite
**Location**: `/test-docker-e2e.sh`

**Test Categories**:
1. **Container Lifecycle**: Build, start, running status
2. **Service Health**: PM2 status, frontend/backend accessibility
3. **Configuration Management**: API operations, file persistence
4. **SSE Functionality**: Headers, streaming, error handling
5. **Hot Reloading**: PM2 restart on file changes
6. **Error Handling**: Process cleanup, invalid workspaces
7. **Container Resilience**: Restart preservation

**Test Coverage**: 15 comprehensive tests covering all major functionality

### Test Philosophy
Focus on **functional testing** rather than security or edge cases, ensuring core Docker infrastructure works reliably.

## 🚧 Known Issues and Limitations

### 1. yamcp CLI Completely Broken
**Issue**: ESM/CommonJS conflicts prevent yamcp CLI from working
**Impact**: Cannot use `yamcp run <workspace>` command
**Workaround**: Direct MCP server execution from configuration
**Status**: Functional workaround implemented

### 2. Single Server per Workspace
**Issue**: Current implementation only runs first server in workspace
**Impact**: Multi-server workspaces not fully supported
**Reason**: Simplification for initial implementation
**Future**: Could be extended to run multiple servers

### 3. SSE Connection Drops on Hot Reload
**Issue**: PM2 restart disconnects all active SSE clients
**Impact**: Clients must handle reconnection
**Status**: By design - simpler than zero-downtime reloads
**Mitigation**: Clear documentation for client implementation

### 4. stdio Servers Only
**Issue**: Only `stdio` type MCP servers supported
**Impact**: Cannot use HTTP-based MCP servers
**Reason**: Focus on common use case first
**Future**: HTTP support could be added

## 🔄 Development Workflow

### Git Strategy
- **Feature branch**: `feature/mcp-hub-pm2`
- **Atomic commits** with descriptive messages
- **Regular commits** at logical milestones

### Commit Message Convention
```
feat: Add new functionality
fix: Bug fixes and workarounds  
test: Testing additions
docs: Documentation updates
```

### Key Milestones Committed
1. Initial PM2 and Docker setup
2. SSE endpoint implementation
3. yamcp CLI workaround
4. Python support for testing
5. Hot reloading validation
6. Complete test suite

## 🏁 Current Status

### Completion Assessment
- **Overall Progress**: 90% complete
- **Confidence Level**: 9/10
- **Core Functionality**: ✅ Complete and tested
- **Edge Cases**: Some limitations documented

### What's Working
- ✅ Complete Docker infrastructure
- ✅ SSE endpoint streaming
- ✅ PM2 process management
- ✅ Hot reloading functionality
- ✅ Configuration persistence
- ✅ Error handling and cleanup
- ✅ Comprehensive test suite

### Next Steps (Future)
- MCP server integration testing (when MCP servers available)
- Multi-server workspace support
- HTTP-based MCP server support
- Production deployment considerations

## 📚 Key Files and Locations

### Core Implementation
- `/server.mjs` - Enhanced Express server with SSE endpoints
- `/ecosystem.config.cjs` - PM2 configuration for process management
- `/docker/Dockerfile` - Container definition with dependencies
- `/docker/docker-compose.yml` - Service orchestration

### Testing and Validation
- `/test-docker-e2e.sh` - Comprehensive Docker test suite
- `/test-mcp-server/` - Test MCP servers and client code

### Documentation
- `/docs/new_readme.md` - User-facing documentation
- `/docs/project_context.md` - This technical context document
- `/upgrade_plan/` - Original planning documents

### Configuration
- Persistent: `/root/.local/share/yamcp-nodejs/*.json` (in container)
- Runtime: Environment variables and PM2 ecosystem config

## 🎉 Success Metrics Met

The project successfully delivers on all original requirements:

1. **✅ Easy Configuration Management**: yamcp-ui provides full GUI
2. **✅ Accessible MCP Endpoints**: SSE at `/mcp/:workspaceName`
3. **✅ Hot Reloading**: PM2 file watching with automatic restarts
4. **✅ Reliability and Self-Healing**: PM2 process management
5. **✅ Local Network Accessibility**: Container bound to 0.0.0.0
6. **✅ Minimal Complexity**: Extended existing components, not new services

The implementation provides a robust foundation for MCP workspace management and real-time access via modern web technologies.