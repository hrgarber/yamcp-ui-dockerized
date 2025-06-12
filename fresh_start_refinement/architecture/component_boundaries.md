# Component Boundaries for AI Delegation

**Status**: Complete  
**Created**: 2025-01-11

## Overview

This document defines clear component boundaries that enable different AI tools to work on isolated parts of the system without interfering with each other.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer                          │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   MCP Client    │    │    Management UI            │ │
│  │  (smolagents)   │    │   (React Dashboard)         │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Express API Gateway                      │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ MCP SSE Handler │    │  Management API Routes      │ │
│  │                 │    │  (/api/workspaces/...)      │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Service Layer                            │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ FastMCP Bridge  │    │  Workspace Manager          │ │
│  │                 │    │                             │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│               FastMCP Process Layer                     │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │FastMCP Instance │    │   MCP Servers               │ │
│  │  (HTTP Server)  │    │ (context7, github, fs)     │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Definitions

### 1. MCP SSE Handler
**Purpose**: Handle MCP protocol communication with clients
**Responsibility**: Protocol compliance and message routing
**AI Assignment**: Claude (complex protocol logic)

**Interface**:
```typescript
interface MCPSSEHandler {
  // Input: Raw SSE connection from MCP client
  handleSSEConnection(req: Request, res: Response): void
  
  // Input: MCP JSON-RPC request
  processMCPRequest(request: MCPRequest): Promise<MCPResponse>
  
  // Output: SSE-formatted response to client
  sendSSEResponse(response: MCPResponse, connection: SSEConnection): void
}
```

**Dependencies**: FastMCP Bridge
**Test Strategy**: Mock FastMCP responses, verify protocol compliance

### 2. FastMCP Bridge
**Purpose**: Communicate with FastMCP HTTP processes
**Responsibility**: HTTP transport and error translation
**AI Assignment**: Claude (network communication and error handling)

**Interface**:
```typescript
interface FastMCPBridge {
  // Input: Workspace identifier and MCP request
  sendRequest(workspace: string, request: MCPRequest): Promise<MCPResponse>
  
  // Output: Health status of FastMCP process
  getHealth(workspace: string): Promise<HealthStatus>
  
  // Lifecycle: Start/stop process communication
  connect(workspace: string): Promise<void>
  disconnect(workspace: string): Promise<void>
}
```

**Dependencies**: Workspace Manager (for process info)
**Test Strategy**: Mock HTTP endpoints, test error scenarios

### 3. Workspace Manager
**Purpose**: Manage workspace lifecycle and configuration
**Responsibility**: Process spawning, config loading, state tracking
**AI Assignment**: Claude (complex state management and process orchestration)

**Interface**:
```typescript
interface WorkspaceManager {
  // Configuration management
  loadWorkspaceConfig(name: string): Promise<WorkspaceConfig>
  validateConfig(config: WorkspaceConfig): ValidationResult
  
  // Process lifecycle
  startWorkspace(name: string): Promise<WorkspaceInfo>
  stopWorkspace(name: string): Promise<void>
  restartWorkspace(name: string): Promise<WorkspaceInfo>
  
  // State queries
  getWorkspaceStatus(name: string): WorkspaceStatus
  listActiveWorkspaces(): WorkspaceInfo[]
}
```

**Dependencies**: Configuration Manager, FastMCP Process Spawner
**Test Strategy**: Mock processes, test lifecycle scenarios

### 4. Configuration Manager
**Purpose**: Load, validate, and watch workspace configurations
**Responsibility**: File system operations and config parsing
**AI Assignment**: Cursor/Copilot (CRUD operations and file handling)

**Interface**:
```typescript
interface ConfigurationManager {
  // File operations
  loadConfig(path: string): Promise<WorkspaceConfig>
  saveConfig(path: string, config: WorkspaceConfig): Promise<void>
  
  // Validation
  validateConfig(config: unknown): ValidationResult
  getDefaultConfig(): WorkspaceConfig
  
  // File watching
  watchConfigChanges(callback: (path: string) => void): void
  stopWatching(): void
}
```

**Dependencies**: None (pure file operations)
**Test Strategy**: Mock file system, test validation rules

### 5. FastMCP Process Spawner
**Purpose**: Spawn and manage FastMCP Python processes
**Responsibility**: Process lifecycle and resource management
**AI Assignment**: Claude (complex process management)

**Interface**:
```typescript
interface FastMCPProcessSpawner {
  // Process management
  spawn(workspace: string, config: WorkspaceConfig): Promise<ProcessInfo>
  kill(processId: string): Promise<void>
  
  // Health monitoring
  isAlive(processId: string): boolean
  getProcessMetrics(processId: string): ProcessMetrics
  
  // Resource management
  allocatePort(): Promise<number>
  releasePort(port: number): void
}
```

**Dependencies**: None (system process operations)
**Test Strategy**: Mock child processes, test resource cleanup

### 6. Management UI Dashboard
**Purpose**: User interface for workspace management
**Responsibility**: Visual display and user interactions
**AI Assignment**: bolt.new (React UI components)

**Interface**:
```typescript
interface ManagementDashboard {
  // Display components
  WorkspaceList: React.Component<{workspaces: WorkspaceInfo[]}>
  WorkspaceDetail: React.Component<{workspace: WorkspaceInfo}>
  ErrorDisplay: React.Component<{error: ApiError}>
  
  // User actions
  onStartWorkspace: (name: string) => void
  onStopWorkspace: (name: string) => void
  onRestartWorkspace: (name: string) => void
  onEditConfig: (name: string) => void
}
```

**Dependencies**: Management API (HTTP endpoints)
**Test Strategy**: Component testing, user interaction scenarios

### 7. Management API Routes
**Purpose**: HTTP API for workspace management operations
**Responsibility**: REST API implementation and request handling
**AI Assignment**: Cursor/Copilot (standard CRUD API patterns)

**Interface**:
```typescript
interface ManagementAPI {
  // Workspace operations
  GET /api/workspaces -> WorkspaceInfo[]
  POST /api/workspaces/:name/start -> WorkspaceInfo
  POST /api/workspaces/:name/stop -> {success: boolean}
  POST /api/workspaces/:name/restart -> WorkspaceInfo
  
  // Configuration operations
  GET /api/workspaces/:name/config -> WorkspaceConfig
  PUT /api/workspaces/:name/config -> ValidationResult
  
  // Monitoring
  GET /api/workspaces/:name/metrics -> ProcessMetrics
  GET /api/workspaces/:name/logs -> LogEntry[]
}
```

**Dependencies**: Workspace Manager
**Test Strategy**: API testing with supertest, mock workspace operations

### 8. FastMCP HTTP Server
**Purpose**: Python server that aggregates MCP servers
**Responsibility**: MCP server aggregation and HTTP serving
**AI Assignment**: Claude (FastMCP integration and Python HTTP server)

**Interface**:
```python
class FastMCPHTTPServer:
    def __init__(self, workspace: str, config: dict, port: int)
    
    # HTTP endpoints
    async def handle_mcp_request(self, request: dict) -> dict
    async def health_check(self) -> dict
    
    # FastMCP integration
    def mount_servers(self, server_configs: list) -> None
    def unmount_server(self, server_name: str) -> None
    
    # Lifecycle
    async def start(self) -> None
    async def stop(self) -> None
```

**Dependencies**: FastMCP library, MCP servers
**Test Strategy**: HTTP endpoint testing, mock MCP servers

## Component Isolation Rules

### 1. Clear Input/Output Contracts
- Each component has explicit interfaces
- No direct access to other component internals
- All communication through defined APIs

### 2. Minimal Dependencies
- Components depend only on interfaces, not implementations
- Circular dependencies prohibited
- Dependency injection for testability

### 3. Error Boundary Isolation
- Each component handles its own error scenarios
- Errors propagated through return values, not exceptions
- Clear error codes and messages at boundaries

### 4. Resource Responsibility
- Each component manages its own resources
- Clear cleanup responsibilities
- No shared mutable state

## AI Assignment Strategy

### Claude Components (Complex Logic)
- MCP SSE Handler: Protocol compliance
- FastMCP Bridge: Network communication
- Workspace Manager: State orchestration  
- Process Spawner: System integration
- FastMCP HTTP Server: Python integration

### bolt.new Components (UI)
- Management Dashboard: React components
- Error displays and user interactions

### Cursor/Copilot Components (CRUD/Boilerplate)
- Configuration Manager: File operations
- Management API: REST endpoints
- Test scaffolding and mock objects

## Integration Points

### Between Claude Components
- Well-defined TypeScript interfaces
- Async/Promise-based communication
- Standardized error handling

### Between Frontend (bolt.new) and Backend (Claude)
- REST API contracts
- JSON response formats
- HTTP status code conventions

### Between Node.js and Python
- HTTP communication protocol
- JSON message formats
- Process lifecycle management

## Testing Strategy by Component

### Unit Testing
- Each component tested in isolation
- Dependencies mocked at interface boundaries
- Clear test scenarios for each interface method

### Integration Testing
- Test component pairs at integration points
- Use real implementations for integration tests
- Focus on contract compliance

### End-to-End Testing
- Full system tests with all components
- Real MCP client interactions
- Performance and reliability scenarios