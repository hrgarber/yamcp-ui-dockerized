/**
 * TypeScript type definitions for MCP Workspace Aggregation
 * Shared interfaces between UI, Manager Service, and Workspace Runtime
 */

// ===== Configuration Types =====

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Unique name for this server within the workspace (used as namespace prefix) */
  name: string;
  
  /** Command to execute for this MCP server */
  command: string;
  
  /** Arguments to pass to the server command (supports ${ENV_VAR} substitution) */
  args?: string[];
  
  /** Environment variables specific to this server */
  env?: Record<string, string>;
  
  /** Retry configuration for server initialization */
  retryPolicy?: {
    /** Maximum number of initialization attempts (default: 3) */
    maxAttempts?: number;
    /** Initial backoff time in milliseconds (default: 1000) */
    backoffMs?: number;
    /** Maximum backoff time in milliseconds (default: 30000) */
    maxBackoffMs?: number;
  };
  
  /** Server initialization timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  /** Configuration object wrapper */
  workspace: {
    /** Unique identifier for the workspace */
    name: string;
    
    /** Optional human-readable description */
    description?: string;
    
    /** List of MCP servers to aggregate */
    servers: MCPServerConfig[];
    
    /** Optional metadata */
    metadata?: Record<string, any>;
  };
}

// ===== Runtime Status Types =====

/**
 * Individual server status within a workspace
 */
export interface ServerStatus {
  /** Server name */
  name: string;
  
  /** Current state of the server */
  state: 'initializing' | 'ready' | 'error' | 'timeout' | 'stopped';
  
  /** Error details if state is 'error' */
  error?: {
    code: number;
    message: string;
    details?: string;
  };
  
  /** Timestamp of last state change */
  lastStateChange: string;
  
  /** Number of initialization attempts */
  initAttempts: number;
  
  /** Available tools from this server */
  tools?: string[];
  
  /** Available resources from this server */
  resources?: string[];
}

/**
 * Workspace runtime status
 */
export interface WorkspaceStatus {
  /** Workspace name */
  name: string;
  
  /** Overall workspace state */
  state: 'starting' | 'running' | 'error' | 'stopped' | 'unhealthy';
  
  /** Container ID if running */
  containerId?: string;
  
  /** Assigned port for SSE endpoint */
  port?: number;
  
  /** Connection URL for MCP clients */
  connectionUrl?: string;
  
  /** Individual server statuses */
  servers: ServerStatus[];
  
  /** Container health status */
  health: {
    /** Basic liveness check */
    alive: boolean;
    /** All servers initialized */
    ready: boolean;
    /** Last health check timestamp */
    lastCheck: string;
    /** Number of consecutive failures */
    failureCount: number;
  };
  
  /** Resource usage */
  resources?: {
    /** Memory usage in MB */
    memoryMB: number;
    /** CPU usage percentage */
    cpuPercent: number;
  };
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  
  /** Current configuration hash */
  configHash: string;
  
  /** Whether configuration has changed since container started */
  configDirty: boolean;
}

// ===== Manager API Types =====

/**
 * Request to create or update a workspace
 */
export interface PublishWorkspaceRequest {
  /** Workspace configuration */
  config: WorkspaceConfig;
  
  /** Force restart even if configuration hasn't changed */
  forceRestart?: boolean;
}

/**
 * Response from workspace publish operation
 */
export interface PublishWorkspaceResponse {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Workspace status after operation */
  workspace?: WorkspaceStatus;
  
  /** Error if operation failed */
  error?: {
    code: number;
    message: string;
    details?: any;
  };
}

/**
 * Manager service API interface
 */
export interface ManagerAPI {
  /** Create or update a workspace */
  publishWorkspace(request: PublishWorkspaceRequest): Promise<PublishWorkspaceResponse>;
  
  /** Get workspace status */
  getWorkspaceStatus(name: string): Promise<WorkspaceStatus | null>;
  
  /** List all workspaces */
  listWorkspaces(): Promise<WorkspaceStatus[]>;
  
  /** Delete a workspace */
  deleteWorkspace(name: string): Promise<{ success: boolean; error?: any }>;
  
  /** Get manager health status */
  getHealth(): Promise<{
    healthy: boolean;
    version: string;
    workspaceCount: number;
    dockerConnected: boolean;
  }>;
}

// ===== MCP Protocol Types =====

/**
 * MCP JSON-RPC request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

/**
 * MCP JSON-RPC response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: MCPError;
  id: string | number;
}

/**
 * MCP JSON-RPC error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP server capabilities
 */
export interface MCPCapabilities {
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: any[];
}

// ===== Event Types =====

/**
 * Workspace state change event
 */
export interface WorkspaceStateChangeEvent {
  workspace: string;
  previousState: WorkspaceStatus['state'];
  newState: WorkspaceStatus['state'];
  timestamp: string;
  reason?: string;
}

/**
 * Server state change event
 */
export interface ServerStateChangeEvent {
  workspace: string;
  server: string;
  previousState: ServerStatus['state'];
  newState: ServerStatus['state'];
  timestamp: string;
  error?: MCPError;
}

// ===== Container Types =====

/**
 * Docker container configuration
 */
export interface ContainerConfig {
  /** Container name */
  name: string;
  
  /** Docker image to use */
  image: string;
  
  /** Environment variables */
  env: Record<string, string>;
  
  /** Port mappings */
  ports: {
    container: number;
    host: number;
  }[];
  
  /** Resource limits */
  resources: {
    /** Memory limit in MB */
    memoryMB: number;
    /** CPU limit (0.5 = half CPU) */
    cpuLimit: number;
  };
  
  /** Restart policy */
  restartPolicy: 'no' | 'on-failure' | 'unless-stopped';
  
  /** Health check configuration */
  healthcheck?: {
    /** Command to run */
    test: string[];
    /** Check interval in seconds */
    interval: number;
    /** Timeout in seconds */
    timeout: number;
    /** Number of retries */
    retries: number;
  };
}

// ===== Utility Types =====

/**
 * Async result type for operations that can fail
 */
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;

/**
 * Port allocation result
 */
export interface PortAllocation {
  /** Allocated port number */
  port: number;
  /** Workspace name */
  workspace: string;
  /** Allocation timestamp */
  allocatedAt: string;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors?: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
}

// ===== Constants =====

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default server initialization timeout (ms) */
  SERVER_TIMEOUT: 30000,
  
  /** Default retry attempts */
  RETRY_ATTEMPTS: 3,
  
  /** Default initial backoff (ms) */
  RETRY_BACKOFF: 1000,
  
  /** Default max backoff (ms) */
  RETRY_MAX_BACKOFF: 30000,
  
  /** Default container memory limit (MB) */
  CONTAINER_MEMORY_MB: 512,
  
  /** Default container CPU limit */
  CONTAINER_CPU_LIMIT: 0.5,
  
  /** Default health check interval (seconds) */
  HEALTH_CHECK_INTERVAL: 30,
  
  /** Default idle timeout before stopping (seconds) */
  IDLE_TIMEOUT: 300,
  
  /** Port range for workspace allocation */
  PORT_RANGE: {
    MIN: 9000,
    MAX: 9999
  }
} as const;

// ===== Type Guards =====

/**
 * Type guard for WorkspaceConfig
 */
export function isWorkspaceConfig(obj: any): obj is WorkspaceConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    'workspace' in obj &&
    typeof obj.workspace.name === 'string' &&
    Array.isArray(obj.workspace.servers)
  );
}

/**
 * Type guard for MCPError
 */
export function isMCPError(obj: any): obj is MCPError {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.code === 'number' &&
    typeof obj.message === 'string'
  );
}

/**
 * Type guard for MCPResponse
 */
export function isMCPResponse(obj: any): obj is MCPResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.jsonrpc === '2.0' &&
    ('result' in obj || 'error' in obj) &&
    'id' in obj
  );
}