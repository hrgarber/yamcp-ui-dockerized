# Comprehensive Error Handling Matrix

**Status**: Complete  
**Created**: 2025-01-11

## Overview

This document catalogs all possible error scenarios, their detection methods, recovery strategies, and user-facing responses.

## Error Categories

### 1. Configuration Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| Invalid JSON syntax | JSON.parse() throws | CONFIG_INVALID_JSON | Show syntax error location | "Configuration file has invalid JSON syntax at line X" |
| Missing required fields | Schema validation | CONFIG_MISSING_FIELD | Use defaults where possible | "Required field 'servers' is missing" |
| Invalid server command | Command validation | CONFIG_INVALID_COMMAND | Suggest valid commands | "Command 'invalidcmd' not supported. Use: npx, node, python" |
| Circular workspace refs | Dependency analysis | CONFIG_CIRCULAR_REF | Block save operation | "Circular dependency detected in workspace references" |
| Workspace name collision | Name uniqueness check | CONFIG_NAME_CONFLICT | Suggest alternative name | "Workspace 'dev' already exists" |
| Environment var missing | Variable resolution | CONFIG_ENV_MISSING | Prompt for value | "Environment variable 'GITHUB_TOKEN' not set" |
| File permission denied | File system access | CONFIG_PERMISSION_DENIED | Check file permissions | "Cannot write to config file: Permission denied" |

### 2. Process Management Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| FastMCP spawn failure | spawn() error | PROCESS_SPAWN_FAILED | Retry with backoff | "Failed to start workspace process. Retrying..." |
| Process crash | exit event listener | PROCESS_CRASHED | Auto-restart (circuit breaker) | "Workspace process crashed. Restarting automatically" |
| Port allocation failure | Port bind error | PROCESS_NO_PORTS | Find alternative port | "No available ports. Trying different port range" |
| Process timeout | Timeout mechanism | PROCESS_TIMEOUT | Kill and restart | "Process failed to start within timeout" |
| Memory exhaustion | Process monitoring | PROCESS_OUT_OF_MEMORY | Restart with limits | "Process exceeded memory limit. Restarting with constraints" |
| Process zombie state | Health check failure | PROCESS_ZOMBIE | Force kill and restart | "Process unresponsive. Force restarting" |
| Too many restarts | Restart counter | PROCESS_RESTART_LIMIT | Stop auto-restart | "Process has crashed too many times. Manual intervention required" |

### 3. HTTP Communication Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| Connection refused | HTTP request error | HTTP_CONNECTION_REFUSED | Check if process running | "Cannot connect to workspace service" |
| Request timeout | HTTP timeout | HTTP_TIMEOUT | Increase timeout, retry | "Request to workspace timed out. Retrying..." |
| HTTP 500 error | Response status | HTTP_INTERNAL_ERROR | Log and retry | "Internal error in workspace service" |
| Malformed response | JSON parse error | HTTP_INVALID_RESPONSE | Log raw response | "Received invalid response from workspace" |
| Network unreachable | Network error | HTTP_NETWORK_ERROR | Check network connectivity | "Network error communicating with workspace" |
| SSL/TLS errors | Certificate errors | HTTP_TLS_ERROR | Check certificates | "Security certificate error" |
| Rate limiting | HTTP 429 | HTTP_RATE_LIMITED | Exponential backoff | "Too many requests. Slowing down..." |

### 4. MCP Protocol Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| Invalid JSON-RPC | Message validation | MCP_INVALID_JSONRPC | Return error response | "Invalid MCP request format" |
| Unknown method | Method lookup | MCP_METHOD_NOT_FOUND | Return -32601 error | "Tool or method not found" |
| Invalid parameters | Parameter validation | MCP_INVALID_PARAMS | Return -32602 error | "Invalid parameters for tool call" |
| Tool execution error | Tool result check | MCP_TOOL_ERROR | Return tool-specific error | "Tool execution failed: [specific error]" |
| SSE connection drop | Connection monitoring | MCP_CONNECTION_LOST | Attempt reconnection | "Connection lost. Reconnecting..." |
| Message ID collision | ID uniqueness check | MCP_DUPLICATE_ID | Generate new ID | "Duplicate message ID detected" |
| Response timeout | Response tracking | MCP_RESPONSE_TIMEOUT | Cancel request | "Tool call timed out" |

### 5. Resource Management Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| Disk space full | Disk usage check | RESOURCE_DISK_FULL | Clean temporary files | "Disk space low. Cleaning up temporary files" |
| Memory limit exceeded | Memory monitoring | RESOURCE_MEMORY_LIMIT | Restart with lower limits | "System memory limit reached" |
| CPU overload | CPU monitoring | RESOURCE_CPU_OVERLOAD | Throttle requests | "High CPU usage. Slowing down operations" |
| File descriptor limit | FD count check | RESOURCE_FD_LIMIT | Close unused connections | "Too many open files. Closing unused connections" |
| Port exhaustion | Port allocation | RESOURCE_NO_PORTS | Wait for port release | "No available ports. Waiting for resources" |
| Concurrent user limit | Connection count | RESOURCE_USER_LIMIT | Queue requests | "Maximum concurrent users reached. You are in queue" |

### 6. File System Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| File not found | fs.readFile error | FS_FILE_NOT_FOUND | Create default file | "Configuration file not found. Creating default" |
| Permission denied | fs access error | FS_PERMISSION_DENIED | Suggest chmod fix | "Cannot access file: Permission denied" |
| Disk read error | IO error | FS_READ_ERROR | Retry with backoff | "Error reading file. Retrying..." |
| Disk write error | IO error | FS_WRITE_ERROR | Check disk space | "Error writing file. Check disk space" |
| File locked | Lock detection | FS_FILE_LOCKED | Wait and retry | "File is locked by another process" |
| Filesystem full | ENOSPC error | FS_DISK_FULL | Clean up space | "Disk is full. Cannot save changes" |
| Path too long | Path validation | FS_PATH_TOO_LONG | Suggest shorter path | "File path is too long" |

### 7. Authentication/Authorization Errors

| Error Scenario | Detection | Error Code | Recovery Strategy | User Message |
|----------------|-----------|------------|-------------------|--------------|
| Invalid API key | Auth validation | AUTH_INVALID_KEY | Prompt for new key | "API key is invalid or expired" |
| Expired token | Token validation | AUTH_TOKEN_EXPIRED | Refresh token | "Authentication token expired. Please re-authenticate" |
| Insufficient permissions | Permission check | AUTH_INSUFFICIENT_PERMS | Request additional perms | "Insufficient permissions for this operation" |
| Rate limit exceeded | API response | AUTH_RATE_LIMITED | Implement backoff | "API rate limit exceeded. Please wait" |
| Account suspended | API response | AUTH_ACCOUNT_SUSPENDED | Contact support | "Account has been suspended. Contact support" |
| IP blocked | Network error | AUTH_IP_BLOCKED | Try different IP | "IP address is blocked" |

## Error Recovery Patterns

### 1. Exponential Backoff
```typescript
class ExponentialBackoff {
  private attempts = 0;
  private readonly maxAttempts: number;
  private readonly baseDelay: number;

  constructor(maxAttempts = 5, baseDelay = 1000) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    while (this.attempts < this.maxAttempts) {
      try {
        const result = await operation();
        this.reset();
        return result;
      } catch (error) {
        this.attempts++;
        
        if (this.attempts >= this.maxAttempts) {
          throw error;
        }
        
        const delay = this.baseDelay * Math.pow(2, this.attempts - 1);
        await this.sleep(delay);
      }
    }
    
    throw new Error('Max attempts exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private reset(): void {
    this.attempts = 0;
  }
}
```

### 2. Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
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

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### 3. Graceful Degradation
```typescript
class GracefulDegradation {
  async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    errorMsg: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      console.warn(`Primary operation failed: ${errorMsg}. Using fallback.`);
      return await fallback();
    }
  }
}
```

## Error Response Formats

### API Error Response
```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    retryable: boolean;
  };
}
```

### MCP Error Response
```typescript
interface MCPErrorResponse {
  jsonrpc: "2.0";
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: {
      component: string;
      originalError: any;
      retryAfter?: number;
    };
  };
}
```

### User-Friendly Error Messages
```typescript
const ERROR_MESSAGES = {
  [ErrorCode.CONFIG_INVALID_JSON]: {
    title: "Configuration Error",
    message: "Your workspace configuration has a formatting error.",
    action: "Please check the JSON syntax and fix any errors.",
    severity: "error"
  },
  [ErrorCode.PROCESS_CRASHED]: {
    title: "Workspace Restart",
    message: "Your workspace service was restarted automatically.",
    action: "Your work was not affected, but you may need to reconnect.",
    severity: "warning"
  },
  [ErrorCode.HTTP_TIMEOUT]: {
    title: "Connection Timeout", 
    message: "The operation is taking longer than expected.",
    action: "Please wait while we retry automatically.",
    severity: "info"
  }
};
```

## Error Monitoring and Alerting

### Error Metrics
```typescript
interface ErrorMetrics {
  errorCount: number;
  errorRate: number; // errors per minute
  errorsByType: Record<string, number>;
  meanTimeToRecovery: number;
  circuitBreakerState: string;
}
```

### Alert Thresholds
- Error rate > 10 errors/minute: Warning
- Circuit breaker open: Critical
- Process restart > 3 times/hour: Warning
- Disk space < 10%: Critical
- Memory usage > 90%: Warning

### Health Check Endpoint
```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    errors: {
      last24h: errorTracker.getErrorCount(24 * 60 * 60 * 1000),
      rate: errorTracker.getErrorRate()
    },
    components: {
      workspace_manager: workspaceManager.getHealth(),
      fastmcp_bridge: bridge.getHealth(),
      config_manager: configManager.getHealth()
    }
  };

  // Set status based on component health
  const unhealthyComponents = Object.values(health.components)
    .filter(status => status !== 'healthy');
  
  if (unhealthyComponents.length > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

This comprehensive error handling matrix ensures robust system behavior and clear user communication across all failure modes.