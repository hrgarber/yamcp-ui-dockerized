# Shared Contracts Documentation

This directory contains the shared contracts and interfaces for the MCP Workspace Aggregation system.

## Files

- **workspace-config.schema.json** - JSON Schema for workspace configuration validation
- **error-codes.js** - Standardized error codes following MCP JSON-RPC protocol
- **types.d.ts** - TypeScript type definitions for all shared interfaces

## Configuration Examples

### Basic Configuration

```json
{
  "workspace": {
    "name": "my-workspace",
    "servers": [
      {
        "name": "github",
        "command": "mcp-server-github",
        "args": ["--token", "${GITHUB_TOKEN}"]
      }
    ]
  }
}
```

### Full Configuration with All Options

```json
{
  "workspace": {
    "name": "production-tools",
    "description": "Production environment MCP servers",
    "servers": [
      {
        "name": "github",
        "command": "mcp-server-github",
        "args": ["--token", "${GITHUB_TOKEN}", "--org", "mycompany"],
        "env": {
          "LOG_LEVEL": "info",
          "GITHUB_API_URL": "https://api.github.com"
        },
        "retryPolicy": {
          "maxAttempts": 5,
          "backoffMs": 2000,
          "maxBackoffMs": 60000
        },
        "timeout": 45000
      },
      {
        "name": "database",
        "command": "mcp-server-postgres",
        "args": ["--connection-string", "${DATABASE_URL}"],
        "env": {
          "PGCONNECT_TIMEOUT": "10"
        },
        "timeout": 60000
      },
      {
        "name": "slack",
        "command": "node",
        "args": ["/app/mcp-servers/slack.js"],
        "env": {
          "SLACK_TOKEN": "${SLACK_BOT_TOKEN}",
          "SLACK_WORKSPACE": "${SLACK_WORKSPACE_ID}"
        }
      }
    ],
    "metadata": {
      "environment": "production",
      "owner": "platform-team",
      "cost-center": "engineering"
    }
  }
}
```

## Edge Cases and Validation Rules

### Workspace Name
- Must be 1-63 characters
- Only lowercase letters, numbers, and hyphens
- Must start and end with alphanumeric character
- Examples: ✅ `my-workspace`, ✅ `test123`, ❌ `-invalid`, ❌ `Invalid_Name`

### Server Name
- Must be 1-32 characters
- Same rules as workspace name
- Must be unique within a workspace
- Used as namespace prefix for tools (e.g., `github.create_issue`)

### Environment Variable Substitution
- Supports `${VAR_NAME}` syntax in args array
- Variables are resolved from container environment
- Missing variables result in empty string
- Examples:
  ```json
  {
    "args": ["--token", "${GITHUB_TOKEN}"],
    "env": {
      "API_URL": "${BASE_URL}/api/v1"
    }
  }
  ```

### Resource Limits
- Maximum 10 servers per workspace
- Server names must be unique within workspace
- Container limits: 512MB RAM, 0.5 CPU (configurable in manager)

## Error Handling

### Error Response Format

All errors follow the MCP JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32002,
    "message": "Server initialization failed",
    "data": {
      "server": "github",
      "details": "Authentication failed: invalid token"
    }
  },
  "id": "req-123"
}
```

### Common Error Scenarios

1. **Invalid Configuration**
   ```javascript
   const { WORKSPACE_ERRORS, createErrorResponse } = require('./error-codes');
   
   const error = createErrorResponse(
     WORKSPACE_ERRORS.INVALID_CONFIGURATION,
     {
       path: "workspace.servers[0].name",
       message: "Server name contains invalid characters"
     }
   );
   ```

2. **Server Initialization Failure**
   ```javascript
   const { MCP_ERRORS, createServerError } = require('./error-codes');
   
   const error = createServerError(
     MCP_ERRORS.SERVER_INITIALIZATION_FAILED,
     "github",
     "Failed to authenticate with GitHub API"
   );
   ```

3. **Container Resource Limits**
   ```javascript
   const { WORKSPACE_ERRORS, createErrorResponse } = require('./error-codes');
   
   const error = createErrorResponse(
     WORKSPACE_ERRORS.RESOURCE_LIMIT_EXCEEDED,
     {
       limit: "memory",
       requested: 1024,
       maximum: 512
     }
   );
   ```

## TypeScript Usage

### Importing Types

```typescript
import type { 
  WorkspaceConfig, 
  WorkspaceStatus, 
  ManagerAPI,
  MCPServerConfig 
} from './types';
```

### Type Guards

```typescript
import { isWorkspaceConfig, isMCPError } from './types';

// Validate configuration
if (!isWorkspaceConfig(data)) {
  throw new Error('Invalid workspace configuration');
}

// Check for MCP errors
if (isMCPError(response.error)) {
  console.error(`MCP Error ${response.error.code}: ${response.error.message}`);
}
```

### Working with Manager API

```typescript
import type { ManagerAPI, PublishWorkspaceRequest } from './types';

class WorkspaceManagerClient implements ManagerAPI {
  async publishWorkspace(request: PublishWorkspaceRequest) {
    // Implementation
  }
  
  async getWorkspaceStatus(name: string) {
    // Implementation
  }
  
  // ... other methods
}
```

## Validation Examples

### Using JSON Schema

```javascript
const Ajv = require('ajv');
const schema = require('./workspace-config.schema.json');

const ajv = new Ajv();
const validate = ajv.compile(schema);

const config = {
  workspace: {
    name: "test",
    servers: [
      { name: "github", command: "mcp-server-github" }
    ]
  }
};

if (!validate(config)) {
  console.error('Validation errors:', validate.errors);
}
```

### Common Validation Errors

1. **Missing Required Fields**
   ```
   Error: /workspace should have required property 'servers'
   ```

2. **Invalid Pattern**
   ```
   Error: /workspace/name should match pattern "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$"
   ```

3. **Array Limits**
   ```
   Error: /workspace/servers should NOT have more than 10 items
   ```

## Best Practices

1. **Always Validate Configuration**
   - Use JSON Schema validation before sending to manager
   - Provide clear error messages to users

2. **Handle Server Failures Gracefully**
   - Individual server failures shouldn't crash the workspace
   - Use retry policies for transient failures

3. **Environment Variables**
   - Store sensitive data (tokens, passwords) in environment variables
   - Use descriptive variable names with prefixes (e.g., `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`)

4. **Error Handling**
   - Always use standardized error codes
   - Include server name in error data for server-specific failures
   - Provide actionable error messages

5. **Timeouts and Retries**
   - Set appropriate timeouts based on server initialization time
   - Use exponential backoff for retries
   - Consider network latency in timeout values