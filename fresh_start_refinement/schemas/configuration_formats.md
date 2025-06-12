# Configuration Format Specifications

**Status**: Complete  
**Created**: 2025-01-11

## Overview

This document defines the exact configuration formats for both YAMCP-UI workspace configurations and FastMCP mounting configurations, including the transformation logic between them.

## YAMCP-UI Configuration Format

Based on examination of the existing codebase and standard MCP configuration patterns:

### Workspace Configuration Structure
```json
{
  "name": "myworkspace",
  "description": "Development workspace with GitHub and context tools",
  "servers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "https://...",
        "UPSTASH_REDIS_REST_TOKEN": "..."
      }
    },
    "github": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  },
  "settings": {
    "autoStart": true,
    "healthCheckInterval": 30,
    "restartPolicy": "on-failure"
  }
}
```

### Configuration Schema
```typescript
interface WorkspaceConfig {
  name: string;
  description?: string;
  servers: Record<string, MCPServerConfig>;
  settings?: WorkspaceSettings;
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

interface WorkspaceSettings {
  autoStart?: boolean;
  healthCheckInterval?: number; // seconds
  restartPolicy?: 'never' | 'on-failure' | 'always';
  maxRestarts?: number;
}
```

### Validation Rules
1. **name**: Required, alphanumeric + hyphens, max 64 chars
2. **servers**: Must have at least one server
3. **command**: Must be executable (npx, node, python, etc.)
4. **args**: Array of strings, no empty strings
5. **env**: String values only, no secrets in plaintext

### Example Configurations

#### Minimal Configuration
```json
{
  "name": "simple-workspace",
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

#### Full Configuration
```json
{
  "name": "full-dev-workspace",
  "description": "Complete development environment",
  "servers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "${UPSTASH_URL}",
        "UPSTASH_REDIS_REST_TOKEN": "${UPSTASH_TOKEN}"
      },
      "timeout": 30
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "cwd": "/workspace"
    },
    "slack": {
      "command": "python",
      "args": ["-m", "slack_mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_TOKEN}"
      }
    }
  },
  "settings": {
    "autoStart": true,
    "healthCheckInterval": 30,
    "restartPolicy": "on-failure",
    "maxRestarts": 3
  }
}
```

## FastMCP Configuration Format

Based on FastMCP library research:

### FastMCP Hub Configuration
```python
# FastMCP mount configuration
mcp_config = {
    "name": "workspace-hub",
    "servers": [
        {
            "prefix": "context7",
            "command": ["npx", "-y", "@upstash/context7-mcp"],
            "env": {"UPSTASH_REDIS_REST_URL": "...", "UPSTASH_REDIS_REST_TOKEN": "..."}
        },
        {
            "prefix": "github", 
            "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "..."}
        },
        {
            "prefix": "filesystem",
            "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        }
    ]
}
```

### FastMCP Implementation Pattern
```python
from fastmcp import FastMCP
import subprocess

def create_fastmcp_hub(config):
    hub = FastMCP(name=config["name"])
    
    for server_config in config["servers"]:
        # Create individual MCP server instance
        server = create_mcp_server(server_config)
        
        # Mount with prefix for namespace isolation
        hub.mount(server_config["prefix"], server)
    
    return hub

def create_mcp_server(server_config):
    # This would spawn the actual MCP server process
    # and wrap it in a FastMCP instance
    pass
```

## Configuration Transformation Logic

### YAMCP-UI → FastMCP Transformation
```typescript
function transformToFastMCP(yamlcpConfig: WorkspaceConfig): FastMCPConfig {
  return {
    name: `${yamlcpConfig.name}-hub`,
    servers: Object.entries(yamlcpConfig.servers).map(([serverName, serverConfig]) => ({
      prefix: serverName,
      command: [serverConfig.command, ...serverConfig.args],
      env: serverConfig.env || {},
      cwd: serverConfig.cwd,
      timeout: serverConfig.timeout || 30
    }))
  };
}
```

### Example Transformation
```javascript
// Input: YAMCP-UI config
const yamlcpConfig = {
  "name": "dev-workspace",
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_123"}
    },
    "filesystem": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
};

// Output: FastMCP config
const fastmcpConfig = {
  "name": "dev-workspace-hub",
  "servers": [
    {
      "prefix": "github",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_123"}
    },
    {
      "prefix": "filesystem",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  ]
};
```

## Environment Variable Handling

### Security Considerations
1. **Never store secrets in config files**
2. **Use environment variable substitution**
3. **Validate environment variables at startup**

### Variable Substitution Pattern
```json
{
  "env": {
    "API_KEY": "${SECRET_API_KEY}",
    "BASE_URL": "${API_BASE_URL:-https://api.default.com}"
  }
}
```

### Implementation
```typescript
function resolveEnvironmentVariables(config: WorkspaceConfig): WorkspaceConfig {
  return {
    ...config,
    servers: Object.fromEntries(
      Object.entries(config.servers).map(([name, server]) => [
        name,
        {
          ...server,
          env: Object.fromEntries(
            Object.entries(server.env || {}).map(([key, value]) => [
              key,
              value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
                const [name, defaultValue] = varName.split(':-');
                return process.env[name] || defaultValue || '';
              })
            ])
          )
        }
      ])
    )
  };
}
```

## Configuration File Locations

### YAMCP-UI Standard Locations
- `./workspaces/{workspace-name}.json`
- `~/.yamcp/workspaces/{workspace-name}.json`
- Environment variable: `YAMCP_CONFIG_DIR`

### Validation and Defaults

### Default Configuration
```json
{
  "settings": {
    "autoStart": false,
    "healthCheckInterval": 30,
    "restartPolicy": "on-failure",
    "maxRestarts": 3
  }
}
```

### Validation Rules
```typescript
const CONFIG_VALIDATION = {
  name: {
    required: true,
    pattern: /^[a-zA-Z0-9-_]+$/,
    maxLength: 64
  },
  servers: {
    required: true,
    minItems: 1,
    maxItems: 20
  },
  'servers.*.command': {
    required: true,
    enum: ['npx', 'node', 'python', 'python3', 'deno']
  },
  'servers.*.args': {
    required: true,
    type: 'array',
    minItems: 1
  }
};
```

## Migration and Compatibility

### Version Compatibility
- Support multiple config versions
- Automatic migration from older formats
- Backward compatibility for 1 major version

### Migration Example
```typescript
function migrateConfig(config: any, version: string): WorkspaceConfig {
  switch (version) {
    case '1.0':
      return migrateFrom1_0(config);
    case '2.0':
      return config; // Current version
    default:
      throw new Error(`Unsupported config version: ${version}`);
  }
}
```