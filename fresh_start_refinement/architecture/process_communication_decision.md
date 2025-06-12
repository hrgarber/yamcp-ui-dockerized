# Process Communication Decision: Express ↔ FastMCP

**Status**: Complete  
**Decision Date**: 2025-01-11

## Context

We need to establish communication between a Node.js Express server and Python FastMCP processes for workspace aggregation. The communication involves JSON message passing for MCP JSON-RPC requests and responses.

## Options Evaluated

### 1. Stdio (Standard Input/Output)
**Mechanism**: Spawn Python child process, communicate via stdin/stdout

**Performance**:
- Latency: ~1-2ms (lowest overhead)
- Throughput: High for moderate loads
- Memory: Minimal additional overhead

**Reliability**:
- Simple but fragile (debug output interference)
- Requires careful message framing
- Process lifecycle tightly coupled

**Implementation Complexity**: Low
- Node.js `child_process.spawn()` 
- JSON delimiter handling required
- Debugging challenges (stdout mixing)

### 2. HTTP (Localhost REST API)
**Mechanism**: FastMCP runs HTTP server, Express makes requests

**Performance**:
- Latency: ~5-15ms (HTTP overhead)
- Throughput: Moderate (HTTP parsing overhead)
- Memory: Higher due to HTTP stack

**Reliability**:
- Excellent (established protocols)
- Built-in error handling and timeouts
- Stateless nature aids recovery

**Implementation Complexity**: Medium
- Familiar web patterns
- Easy debugging with HTTP tools
- Port management required

### 3. Unix Sockets (Domain Sockets)
**Mechanism**: File-based socket communication

**Performance**:
- Latency: ~1-3ms (minimal OS overhead)
- Throughput: Very high
- Memory: Low overhead

**Reliability**:
- Very reliable for local IPC
- Socket file cleanup required
- Platform-specific (Unix-like only)

**Implementation Complexity**: Medium-High
- Lower-level socket programming
- File permission management
- Cross-platform complications

### 4. Named Pipes
**Mechanism**: Platform-specific pipe communication

**Performance**:
- Latency: ~1-3ms (similar to Unix sockets)
- Throughput: High
- Memory: Low overhead

**Reliability**:
- Reliable but platform-dependent
- Complex cross-platform support
- Pipe naming and cleanup issues

**Implementation Complexity**: High
- Platform-specific APIs
- Complex error handling
- Limited cross-platform support

## Decision Matrix

| Criteria | Stdio | HTTP | Unix Sockets | Named Pipes |
|----------|-------|------|-------------|-------------|
| Latency | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Throughput | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Reliability | ★★☆☆☆ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Debugging | ★★☆☆☆ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| Cross-Platform | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| Implementation | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★☆☆☆☆ |
| **Total** | **19/30** | **22/30** | **20/30** | **16/30** |

## Selected Approach: HTTP

**Primary Rationale**: While HTTP has slightly higher latency, it provides the best balance of reliability, debugging capability, and implementation simplicity.

**Specific Benefits for Our Use Case**:

1. **Debugging & Monitoring**: HTTP tools and logs make troubleshooting easier
2. **Error Handling**: Established HTTP status codes and error patterns
3. **Future Flexibility**: Easy to distribute across machines later
4. **Developer Familiarity**: Standard web patterns reduce learning curve
5. **Stateless Operation**: Easier process restart and recovery

**Acceptable Trade-offs**:
- ~5-15ms latency is acceptable for MCP operations
- HTTP overhead is minimal compared to MCP server processing time
- Performance can be optimized with keep-alive connections

## Implementation Design

### FastMCP HTTP Server
```python
# fastmcp_http_server.py
from fastapi import FastAPI
from fastmcp import FastMCP

app = FastAPI()
hub = FastMCP(name="workspace-hub")

@app.post("/mcp")
async def handle_mcp_request(request: dict):
    # Process MCP JSON-RPC request
    response = await hub.handle_request(request)
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
```

### Express Server Integration
```javascript
// express-fastmcp-bridge.js
const axios = require('axios');

class FastMCPBridge {
  constructor(workspace, port) {
    this.baseURL = `http://127.0.0.1:${port}`;
    this.workspace = workspace;
  }

  async sendMCPRequest(jsonRpcRequest) {
    try {
      const response = await axios.post(`${this.baseURL}/mcp`, jsonRpcRequest, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: jsonRpcRequest.id,
        error: {
          code: -32603,
          message: "FastMCP communication error",
          data: { error: error.message }
        }
      };
    }
  }
}
```

### Process Management
```javascript
// process-manager.js
const { spawn } = require('child_process');

class FastMCPProcessManager {
  constructor() {
    this.processes = new Map(); // workspace -> process
    this.ports = new Map();     // workspace -> port
  }

  async startWorkspace(workspace, config) {
    const port = await this.allocatePort();
    const process = spawn('python', ['fastmcp_http_server.py', 
      '--workspace', workspace, 
      '--port', port,
      '--config', JSON.stringify(config)
    ]);
    
    this.processes.set(workspace, process);
    this.ports.set(workspace, port);
    
    // Wait for HTTP server to be ready
    await this.waitForHealthCheck(port);
    return new FastMCPBridge(workspace, port);
  }
}
```

## Performance Optimizations

1. **HTTP Keep-Alive**: Reuse connections to reduce handshake overhead
2. **Connection Pooling**: Maintain connection pools per FastMCP instance
3. **Request Timeouts**: Appropriate timeouts for different operation types
4. **Port Allocation**: Dynamic port assignment to avoid conflicts

## Error Handling Strategy

1. **HTTP Status Codes**: Use standard codes for different error types
2. **JSON-RPC Errors**: Preserve MCP error semantics
3. **Process Recovery**: Restart FastMCP on HTTP failures
4. **Circuit Breaker**: Prevent cascade failures

## Testing Strategy

1. **Unit Tests**: Mock HTTP communication for component tests
2. **Integration Tests**: Real HTTP communication with test FastMCP instances
3. **Performance Tests**: Latency and throughput benchmarks
4. **Reliability Tests**: Network failure and recovery scenarios

## Alternative Considered

If performance becomes critical, **Unix Sockets** would be the next choice:
- Implement as fallback for high-throughput scenarios
- Use HTTP for development/debugging, sockets for production
- Abstract communication layer to support both protocols

## Decision Rationale Summary

HTTP wins due to:
1. **Operational Simplicity**: Standard debugging and monitoring tools
2. **Reliability**: Proven error handling and recovery patterns  
3. **Future Flexibility**: Easy to scale beyond single machine
4. **Team Productivity**: Faster development and troubleshooting

The ~10ms latency overhead is acceptable given MCP operations typically take 100ms+ for actual work (API calls, file operations, etc.).