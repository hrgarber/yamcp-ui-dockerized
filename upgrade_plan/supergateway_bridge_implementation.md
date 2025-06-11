# SuperGateway Bridge Implementation Guide

## Overview

This document details how to implement workspace aggregation using SuperGateway as the bridge between stdio MCP servers and HTTP endpoints, with a custom aggregation layer.

## Architecture

```
MCP Client (smolagents)
    ↓ HTTP/SSE
Express SSE Endpoint (/mcp/:workspace)
    ↓
Workspace Aggregator (custom)
    ↓ HTTP (multiple requests)
SuperGateway Instances (one per server)
    ↓ stdio
MCP Servers (context7, github, filesystem, etc.)
```

## Implementation Components

### 1. SuperGateway Process Manager

```javascript
class SuperGatewayManager {
  constructor() {
    this.runningGateways = new Map(); // workspaceName -> gatewayInfo[]
    this.portCounter = 9000; // Starting port for SuperGateway instances
  }
  
  async startWorkspaceGateways(workspaceName, serverNames) {
    // Clean up any existing gateways for this workspace
    await this.stopWorkspaceGateways(workspaceName);
    
    const gateways = [];
    const startPort = this.portCounter;
    
    for (let i = 0; i < serverNames.length; i++) {
      const serverName = serverNames[i];
      const port = startPort + i;
      
      try {
        const gateway = await this.startSingleGateway(serverName, port);
        gateways.push({
          serverName,
          port,
          process: gateway,
          baseUrl: `http://localhost:${port}`
        });
      } catch (error) {
        console.error(`Failed to start gateway for ${serverName}:`, error);
        // Continue with other servers
      }
    }
    
    this.runningGateways.set(workspaceName, gateways);
    this.portCounter += serverNames.length;
    
    // Wait for all gateways to be ready
    await this.waitForGatewaysReady(gateways);
    
    return gateways;
  }
  
  async startSingleGateway(serverName, port) {
    const command = 'npx';
    const args = [
      'supergateway',
      '--stdio',
      `uvx mcp-server-${serverName}`, // Adjust based on your server naming
      '--port',
      port.toString()
    ];
    
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    process.stdout.on('data', (data) => {
      console.log(`SuperGateway[${serverName}:${port}]: ${data}`);
    });
    
    process.stderr.on('data', (data) => {
      console.error(`SuperGateway[${serverName}:${port}] ERROR: ${data}`);
    });
    
    process.on('close', (code) => {
      console.log(`SuperGateway[${serverName}:${port}] exited with code ${code}`);
    });
    
    return process;
  }
  
  async waitForGatewaysReady(gateways, timeoutMs = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const readyChecks = gateways.map(async (gateway) => {
        try {
          const response = await fetch(`${gateway.baseUrl}/health`, {
            method: 'GET',
            timeout: 1000
          });
          return response.ok;
        } catch {
          return false;
        }
      });
      
      const results = await Promise.all(readyChecks);
      if (results.every(ready => ready)) {
        console.log(`All ${gateways.length} gateways ready`);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for gateways to be ready`);
  }
  
  async stopWorkspaceGateways(workspaceName) {
    const gateways = this.runningGateways.get(workspaceName);
    if (!gateways) return;
    
    for (const gateway of gateways) {
      if (gateway.process && !gateway.process.killed) {
        gateway.process.kill('SIGTERM');
      }
    }
    
    this.runningGateways.delete(workspaceName);
  }
  
  cleanup() {
    for (const workspaceName of this.runningGateways.keys()) {
      this.stopWorkspaceGateways(workspaceName);
    }
  }
}
```

### 2. Tool Discovery Aggregator

```javascript
class ToolDiscoveryAggregator {
  constructor(gateways) {
    this.gateways = gateways; // [{ serverName, port, baseUrl }]
  }
  
  async discoverAllTools() {
    const toolDiscoveryPromises = this.gateways.map(gateway => 
      this.discoverToolsFromGateway(gateway)
    );
    
    const toolArrays = await Promise.allSettled(toolDiscoveryPromises);
    
    const allTools = [];
    toolArrays.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTools.push(...result.value);
      } else {
        console.error(`Tool discovery failed for ${this.gateways[index].serverName}:`, 
                     result.reason);
      }
    });
    
    return this.processToolConflicts(allTools);
  }
  
  async discoverToolsFromGateway(gateway) {
    const response = await fetch(`${gateway.baseUrl}/tools/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message}`);
    }
    
    // Add server metadata to each tool
    return data.result.tools.map(tool => ({
      ...tool,
      _serverName: gateway.serverName,
      _gatewayPort: gateway.port,
      _gatewayUrl: gateway.baseUrl
    }));
  }
  
  processToolConflicts(tools) {
    const toolMap = new Map();
    const conflicts = [];
    
    for (const tool of tools) {
      if (toolMap.has(tool.name)) {
        conflicts.push({
          toolName: tool.name,
          servers: [toolMap.get(tool.name)._serverName, tool._serverName]
        });
        
        // For now, keep first occurrence (could implement priority logic)
        continue;
      }
      
      toolMap.set(tool.name, tool);
    }
    
    if (conflicts.length > 0) {
      console.warn('Tool name conflicts detected:', conflicts);
    }
    
    return {
      tools: Array.from(toolMap.values()),
      conflicts
    };
  }
}
```

### 3. Request Router

```javascript
class WorkspaceRequestRouter {
  constructor(gateways, toolRegistry) {
    this.gateways = gateways;
    this.toolRegistry = toolRegistry; // Map of tool name -> gateway info
  }
  
  static fromDiscoveryResult(gateways, discoveryResult) {
    const toolRegistry = new Map();
    
    for (const tool of discoveryResult.tools) {
      toolRegistry.set(tool.name, {
        serverName: tool._serverName,
        gatewayUrl: tool._gatewayUrl,
        tool: tool
      });
    }
    
    return new WorkspaceRequestRouter(gateways, toolRegistry);
  }
  
  async callTool(toolName, arguments_) {
    const toolInfo = this.toolRegistry.get(toolName);
    
    if (!toolInfo) {
      throw new Error(`Tool '${toolName}' not found in workspace`);
    }
    
    const response = await fetch(`${toolInfo.gatewayUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: arguments_
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`MCP Error calling ${toolName}: ${data.error.message}`);
    }
    
    return data.result;
  }
  
  getAvailableTools() {
    return Array.from(this.toolRegistry.keys());
  }
  
  getToolInfo(toolName) {
    const info = this.toolRegistry.get(toolName);
    return info ? info.tool : null;
  }
}
```

### 4. Workspace Aggregator (Main Class)

```javascript
class WorkspaceAggregator {
  constructor(workspaceName, workspaceConfig) {
    this.workspaceName = workspaceName;
    this.workspaceConfig = workspaceConfig;
    this.gatewayManager = new SuperGatewayManager();
    this.router = null;
    this.isReady = false;
  }
  
  async initialize() {
    try {
      // Start all SuperGateway instances
      const gateways = await this.gatewayManager.startWorkspaceGateways(
        this.workspaceName,
        this.workspaceConfig.servers
      );
      
      // Discover tools from all gateways
      const discoverer = new ToolDiscoveryAggregator(gateways);
      const discoveryResult = await discoverer.discoverAllTools();
      
      // Create request router
      this.router = WorkspaceRequestRouter.fromDiscoveryResult(gateways, discoveryResult);
      
      this.isReady = true;
      
      return {
        success: true,
        toolCount: discoveryResult.tools.length,
        servers: gateways.map(g => g.serverName),
        conflicts: discoveryResult.conflicts
      };
      
    } catch (error) {
      console.error(`Failed to initialize workspace ${this.workspaceName}:`, error);
      await this.cleanup();
      throw error;
    }
  }
  
  async handleSSEConnection(res) {
    if (!this.isReady) {
      throw new Error('Workspace not ready');
    }
    
    // Send initial tool list
    const tools = this.router.getAvailableTools().map(name => {
      const info = this.router.getToolInfo(name);
      return {
        name: info.name,
        description: info.description,
        inputSchema: info.inputSchema
      };
    });
    
    res.write(`data: ${JSON.stringify({
      type: 'tools/list',
      tools: tools
    })}\n\n`);
    
    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      })}\n\n`);
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      this.cleanup();
    };
  }
  
  async executeToolCall(toolName, arguments_) {
    if (!this.isReady) {
      throw new Error('Workspace not ready');
    }
    
    return await this.router.callTool(toolName, arguments_);
  }
  
  async cleanup() {
    if (this.gatewayManager) {
      await this.gatewayManager.stopWorkspaceGateways(this.workspaceName);
    }
    this.isReady = false;
  }
}
```

## Integration with Express Server

```javascript
// Add to server.mjs
const activeWorkspaces = new Map(); // workspaceName -> WorkspaceAggregator

app.get('/mcp/:workspaceName', async (req, res) => {
  const { workspaceName } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  
  try {
    // Get workspace configuration
    const workspaceConfig = getRealWorkspaces()[workspaceName];
    if (!workspaceConfig) {
      throw new Error(`Workspace '${workspaceName}' not found`);
    }
    
    // Stop any existing workspace
    if (activeWorkspaces.has(workspaceName)) {
      await activeWorkspaces.get(workspaceName).cleanup();
    }
    
    // Start new workspace aggregator
    const aggregator = new WorkspaceAggregator(workspaceName, workspaceConfig);
    const initResult = await aggregator.initialize();
    
    activeWorkspaces.set(workspaceName, aggregator);
    
    res.write(`data: ${JSON.stringify({
      type: 'workspace/ready',
      workspace: workspaceName,
      ...initResult
    })}\n\n`);
    
    // Set up SSE streaming
    const cleanup = await aggregator.handleSSEConnection(res);
    
    req.on('close', () => {
      console.log(`Client disconnected from workspace ${workspaceName}`);
      cleanup();
      activeWorkspaces.delete(workspaceName);
    });
    
  } catch (error) {
    console.error(`Workspace error for ${workspaceName}:`, error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message
    })}\n\n`);
    res.end();
  }
});

// Handle tool execution requests (if needed via separate endpoint)
app.post('/mcp/:workspaceName/call', async (req, res) => {
  const { workspaceName } = req.params;
  const { toolName, arguments: args } = req.body;
  
  try {
    const aggregator = activeWorkspaces.get(workspaceName);
    if (!aggregator) {
      return res.status(404).json({ error: 'Workspace not active' });
    }
    
    const result = await aggregator.executeToolCall(toolName, args);
    res.json({ result });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Testing the Implementation

```bash
# 1. Start a workspace
curl -N http://localhost:8765/mcp/test-workspace

# 2. Test with smolagents
python3 << EOF
from smolagents import ToolCollection

try:
    with ToolCollection.from_mcp("http://localhost:8765/mcp/test-workspace") as tools:
        print(f"Discovered {len(tools.tools)} tools:")
        for tool in tools.tools:
            print(f"  - {tool.name}: {tool.description}")
except Exception as e:
    print(f"Error: {e}")
EOF
```

## Error Handling and Monitoring

```javascript
// Add to WorkspaceAggregator
async healthCheck() {
  const gateways = this.gatewayManager.runningGateways.get(this.workspaceName) || [];
  const healthResults = [];
  
  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway.baseUrl}/health`, { timeout: 2000 });
      healthResults.push({
        server: gateway.serverName,
        port: gateway.port,
        healthy: response.ok
      });
    } catch {
      healthResults.push({
        server: gateway.serverName,
        port: gateway.port,
        healthy: false
      });
    }
  }
  
  return healthResults;
}
```

This implementation provides a robust foundation for workspace aggregation using SuperGateway as the proven MCP protocol bridge, while maintaining the flexibility to enhance and optimize the aggregation layer.