# State Management Strategy

**Status**: Complete  
**Created**: 2025-01-11

## Overview

This document defines where and how state is managed across the distributed system components, ensuring consistency and reliability.

## State Categories

### 1. Workspace Configuration State
**Owner**: Configuration Manager  
**Scope**: File-based, persistent  
**Purpose**: Workspace definitions and MCP server configurations

**Storage**:
```
workspaces/
├── dev-workspace.json
├── prod-workspace.json
└── test-workspace.json
```

**State Structure**:
```typescript
interface WorkspaceConfigState {
  [workspaceName: string]: {
    config: WorkspaceConfig;
    lastModified: Date;
    version: string;
  }
}
```

**Management**:
- File watcher detects changes
- In-memory cache with TTL
- Validation on load/save
- Hot reload triggers workspace restart

### 2. Process Lifecycle State
**Owner**: Workspace Manager  
**Scope**: In-memory, runtime  
**Purpose**: Track FastMCP process status and health

**State Structure**:
```typescript
interface ProcessState {
  [workspaceName: string]: {
    processId: string;
    port: number;
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
    startTime: Date;
    lastHealthCheck: Date;
    restartCount: number;
    errorHistory: ProcessError[];
  }
}
```

**Transitions**:
```
stopped → starting → running
running → stopping → stopped  
running → error → starting (auto-restart)
```

**Persistence**: None (rebuilt on service restart)

### 3. SSE Connection State
**Owner**: MCP SSE Handler  
**Scope**: In-memory, per-request  
**Purpose**: Track active client connections and message correlation

**State Structure**:
```typescript
interface SSEConnectionState {
  [connectionId: string]: {
    workspace: string;
    clientInfo: ClientInfo;
    connectedAt: Date;
    lastActivity: Date;
    activeRequests: Map<string, PendingRequest>; // request ID → request
  }
}

interface PendingRequest {
  id: string;
  method: string;
  startTime: Date;
  timeout: NodeJS.Timeout;
}
```

**Cleanup**: Connection closed, timeout, or process restart

### 4. Resource Allocation State  
**Owner**: FastMCP Process Spawner  
**Scope**: In-memory, persistent tracking  
**Purpose**: Port allocation and resource limits

**State Structure**:
```typescript
interface ResourceState {
  allocatedPorts: Set<number>;
  portRange: { min: number; max: number };
  processLimits: {
    maxWorkspaces: number;
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
  currentUsage: {
    activeProcesses: number;
    totalMemoryMB: number;
    avgCpuPercent: number;
  };
}
```

**Persistence**: Port allocations survive restarts

### 5. Error and Recovery State
**Owner**: Distributed across components  
**Scope**: In-memory with optional persistence  
**Purpose**: Circuit breaker state and error tracking

**State Structure**:
```typescript
interface ErrorState {
  [componentId: string]: {
    circuitBreaker: {
      state: 'closed' | 'open' | 'half-open';
      failureCount: number;
      lastFailure: Date;
      nextRetry: Date;
    };
    recentErrors: ErrorRecord[];
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  }
}
```

## State Synchronization Patterns

### 1. Configuration → Process State Sync
**Trigger**: Configuration file change  
**Flow**: 
1. Configuration Manager detects file change
2. Emits `configChanged` event with workspace name
3. Workspace Manager receives event
4. Validates new configuration
5. Gracefully restarts FastMCP process
6. Updates process state

**Race Condition Handling**:
```typescript
class WorkspaceManager {
  private configLocks = new Map<string, Promise<void>>();

  async handleConfigChange(workspace: string) {
    // Prevent concurrent config changes
    const existingLock = this.configLocks.get(workspace);
    if (existingLock) {
      await existingLock;
    }

    const lock = this.restartWorkspace(workspace);
    this.configLocks.set(workspace, lock);
    
    try {
      await lock;
    } finally {
      this.configLocks.delete(workspace);
    }
  }
}
```

### 2. Process State → SSE Connection Sync
**Trigger**: Process state change  
**Flow**:
1. Process state changes (starting, running, error, stopped)
2. Workspace Manager emits `processStateChanged` event
3. MCP SSE Handler receives event
4. Updates active connections with new state
5. May send error notifications to clients

**Client Notification**:
```typescript
// Send process state changes to connected clients
async notifyClientsOfProcessState(workspace: string, state: ProcessState) {
  const connections = this.getConnectionsForWorkspace(workspace);
  
  for (const connection of connections) {
    const notification = {
      jsonrpc: "2.0",
      method: "workspace/statusChanged",
      params: { 
        workspace, 
        status: state.status,
        timestamp: new Date().toISOString()
      }
    };
    
    this.sendSSENotification(connection, notification);
  }
}
```

### 3. Resource State Coordination
**Challenge**: Multiple processes competing for resources  
**Solution**: Centralized resource manager with atomic operations

```typescript
class ResourceManager {
  private portLock = new AsyncMutex();
  
  async allocatePort(): Promise<number> {
    return this.portLock.runExclusive(async () => {
      for (let port = this.portRange.min; port <= this.portRange.max; port++) {
        if (!this.allocatedPorts.has(port)) {
          this.allocatedPorts.add(port);
          return port;
        }
      }
      throw new Error('No available ports');
    });
  }
}
```

## State Persistence Strategy

### 1. Configuration State (Persistent)
- **Storage**: JSON files on disk
- **Backup**: Git-backed with automatic commits
- **Recovery**: Load from disk on startup

### 2. Process State (Ephemeral)
- **Storage**: In-memory only
- **Recovery**: Rebuild by querying actual process status
- **Reason**: Process IDs change on restart anyway

### 3. Resource State (Semi-Persistent)
- **Storage**: JSON file for port allocations
- **Recovery**: Clean up stale allocations on startup
- **Validation**: Check if ports actually in use

```typescript
async function validatePortAllocations() {
  const allocatedPorts = await this.loadPortAllocations();
  const activePorts = new Set<number>();
  
  for (const port of allocatedPorts) {
    if (await this.isPortInUse(port)) {
      activePorts.add(port);
    }
  }
  
  this.allocatedPorts = activePorts;
  await this.savePortAllocations();
}
```

## State Event System

### Event Types
```typescript
type StateEvent = 
  | { type: 'config/changed', workspace: string, config: WorkspaceConfig }
  | { type: 'process/started', workspace: string, processInfo: ProcessInfo }
  | { type: 'process/stopped', workspace: string, reason: string }
  | { type: 'process/error', workspace: string, error: ProcessError }
  | { type: 'connection/opened', connectionId: string, workspace: string }
  | { type: 'connection/closed', connectionId: string }
  | { type: 'resource/allocated', resource: ResourceAllocation }
  | { type: 'resource/released', resource: ResourceAllocation };
```

### Event Bus Implementation
```typescript
class StateEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  subscribe<T extends StateEvent>(
    eventType: T['type'], 
    handler: (event: T) => void | Promise<void>
  ) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }
  
  async emit<T extends StateEvent>(event: T) {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    
    // Execute handlers in parallel
    await Promise.all(
      Array.from(handlers).map(handler => 
        Promise.resolve(handler(event)).catch(err => 
          console.error(`Event handler error for ${event.type}:`, err)
        )
      )
    );
  }
}
```

## Error Recovery Patterns

### 1. Optimistic Updates with Rollback
```typescript
async function updateWorkspaceConfig(workspace: string, newConfig: WorkspaceConfig) {
  const backup = await this.getWorkspaceConfig(workspace);
  
  try {
    // Optimistic update
    await this.saveWorkspaceConfig(workspace, newConfig);
    await this.restartWorkspace(workspace);
  } catch (error) {
    // Rollback on failure
    await this.saveWorkspaceConfig(workspace, backup);
    throw error;
  }
}
```

### 2. Circuit Breaker for Process Management
```typescript
class ProcessCircuitBreaker {
  private state = 'closed';
  private failureCount = 0;
  private nextRetry = Date.now();
  
  async executeWithBreaker<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open' && Date.now() < this.nextRetry) {
      throw new Error('Circuit breaker is OPEN');
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= 5) {
      this.state = 'open';
      this.nextRetry = Date.now() + 30000; // 30 second backoff
    }
  }
}
```

## State Monitoring and Debugging

### 1. State Inspection API
```typescript
// GET /api/debug/state/:component
app.get('/api/debug/state/:component', (req, res) => {
  const { component } = req.params;
  
  switch (component) {
    case 'workspace':
      res.json(workspaceManager.getInternalState());
      break;
    case 'connections':
      res.json(sseHandler.getConnectionState());
      break;
    case 'resources':
      res.json(resourceManager.getResourceState());
      break;
    default:
      res.status(404).json({ error: 'Unknown component' });
  }
});
```

### 2. State Validation
```typescript
async function validateSystemState(): Promise<ValidationResult[]> {
  const issues: ValidationResult[] = [];
  
  // Check process state consistency
  for (const [workspace, processState] of this.processStates) {
    if (processState.status === 'running') {
      const isActuallyRunning = await this.isProcessRunning(processState.processId);
      if (!isActuallyRunning) {
        issues.push({
          component: 'process',
          workspace,
          issue: 'Process marked running but not found',
          severity: 'error'
        });
      }
    }
  }
  
  return issues;
}
```

This state management strategy ensures data consistency across components while maintaining clear ownership and avoiding state synchronization issues.