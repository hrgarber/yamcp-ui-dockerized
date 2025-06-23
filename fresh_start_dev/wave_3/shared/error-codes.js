/**
 * Standardized error codes for MCP Workspace Aggregation
 * Following JSON-RPC 2.0 and MCP protocol standards
 */

// JSON-RPC 2.0 Standard Error Codes
const JSON_RPC_ERRORS = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: {
    code: -32700,
    message: 'Parse error',
    description: 'Invalid JSON was received by the server'
  },
  INVALID_REQUEST: {
    code: -32600,
    message: 'Invalid Request',
    description: 'The JSON sent is not a valid Request object'
  },
  METHOD_NOT_FOUND: {
    code: -32601,
    message: 'Method not found',
    description: 'The method does not exist / is not available'
  },
  INVALID_PARAMS: {
    code: -32602,
    message: 'Invalid params',
    description: 'Invalid method parameter(s)'
  },
  INTERNAL_ERROR: {
    code: -32603,
    message: 'Internal error',
    description: 'Internal JSON-RPC error'
  }
};

// MCP Protocol Specific Error Codes (-32000 to -32099)
const MCP_ERRORS = {
  // Server lifecycle errors
  SERVER_NOT_INITIALIZED: {
    code: -32001,
    message: 'Server not initialized',
    description: 'The MCP server has not been initialized yet'
  },
  SERVER_INITIALIZATION_FAILED: {
    code: -32002,
    message: 'Server initialization failed',
    description: 'Failed to initialize the MCP server'
  },
  SERVER_TIMEOUT: {
    code: -32003,
    message: 'Server timeout',
    description: 'The MCP server did not respond within the timeout period'
  },
  SERVER_UNAVAILABLE: {
    code: -32004,
    message: 'Server unavailable',
    description: 'The MCP server is not available or has crashed'
  },
  
  // Tool execution errors
  TOOL_NOT_FOUND: {
    code: -32010,
    message: 'Tool not found',
    description: 'The requested tool does not exist on any server'
  },
  TOOL_EXECUTION_FAILED: {
    code: -32011,
    message: 'Tool execution failed',
    description: 'Failed to execute the requested tool'
  },
  TOOL_PERMISSION_DENIED: {
    code: -32012,
    message: 'Tool permission denied',
    description: 'Permission denied to execute the requested tool'
  },
  
  // Resource errors
  RESOURCE_NOT_FOUND: {
    code: -32020,
    message: 'Resource not found',
    description: 'The requested resource does not exist'
  },
  RESOURCE_ACCESS_DENIED: {
    code: -32021,
    message: 'Resource access denied',
    description: 'Access denied to the requested resource'
  },
  
  // Transport errors
  TRANSPORT_ERROR: {
    code: -32030,
    message: 'Transport error',
    description: 'Error in the transport layer (SSE/WebSocket)'
  },
  CONNECTION_CLOSED: {
    code: -32031,
    message: 'Connection closed',
    description: 'The connection was closed unexpectedly'
  }
};

// Workspace Manager Specific Error Codes (-32100 to -32199)
const WORKSPACE_ERRORS = {
  // Configuration errors
  INVALID_CONFIGURATION: {
    code: -32100,
    message: 'Invalid workspace configuration',
    description: 'The workspace configuration is invalid or malformed'
  },
  CONFIGURATION_VALIDATION_FAILED: {
    code: -32101,
    message: 'Configuration validation failed',
    description: 'The workspace configuration failed validation'
  },
  
  // Container lifecycle errors
  CONTAINER_START_FAILED: {
    code: -32110,
    message: 'Container start failed',
    description: 'Failed to start the workspace container'
  },
  CONTAINER_STOP_FAILED: {
    code: -32111,
    message: 'Container stop failed',
    description: 'Failed to stop the workspace container'
  },
  CONTAINER_NOT_FOUND: {
    code: -32112,
    message: 'Container not found',
    description: 'The workspace container does not exist'
  },
  CONTAINER_ALREADY_EXISTS: {
    code: -32113,
    message: 'Container already exists',
    description: 'A container for this workspace already exists'
  },
  CONTAINER_UNHEALTHY: {
    code: -32114,
    message: 'Container unhealthy',
    description: 'The workspace container is in an unhealthy state'
  },
  
  // Resource management errors
  PORT_ALLOCATION_FAILED: {
    code: -32120,
    message: 'Port allocation failed',
    description: 'Failed to allocate a port for the workspace'
  },
  RESOURCE_LIMIT_EXCEEDED: {
    code: -32121,
    message: 'Resource limit exceeded',
    description: 'Workspace resource limits exceeded'
  },
  MAX_WORKSPACES_EXCEEDED: {
    code: -32122,
    message: 'Maximum workspaces exceeded',
    description: 'Maximum number of concurrent workspaces exceeded'
  },
  
  // Workspace state errors
  WORKSPACE_NOT_FOUND: {
    code: -32130,
    message: 'Workspace not found',
    description: 'The requested workspace does not exist'
  },
  WORKSPACE_ALREADY_EXISTS: {
    code: -32131,
    message: 'Workspace already exists',
    description: 'A workspace with this name already exists'
  },
  WORKSPACE_NOT_RUNNING: {
    code: -32132,
    message: 'Workspace not running',
    description: 'The workspace is not in a running state'
  },
  WORKSPACE_BUSY: {
    code: -32133,
    message: 'Workspace busy',
    description: 'The workspace is busy with another operation'
  }
};

/**
 * Helper function to create an MCP-compliant error response
 * @param {Object} error - Error definition from the constants above
 * @param {Object} data - Additional error data
 * @param {string|number} id - Request ID
 * @returns {Object} MCP-compliant error response
 */
function createErrorResponse(error, data = null, id = null) {
  const response = {
    jsonrpc: '2.0',
    error: {
      code: error.code,
      message: error.message
    }
  };
  
  if (data !== null) {
    response.error.data = data;
  }
  
  if (id !== null) {
    response.id = id;
  }
  
  return response;
}

/**
 * Helper function to create an error with server context
 * @param {Object} error - Error definition
 * @param {string} serverName - Name of the server that failed
 * @param {string} details - Additional details
 * @param {string|number} id - Request ID
 * @returns {Object} MCP-compliant error response with server context
 */
function createServerError(error, serverName, details = null, id = null) {
  const data = { server: serverName };
  if (details) {
    data.details = details;
  }
  return createErrorResponse(error, data, id);
}

/**
 * Helper function to check if an error code is retryable
 * @param {number} code - Error code
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(code) {
  const retryableCodes = [
    MCP_ERRORS.SERVER_TIMEOUT.code,
    MCP_ERRORS.SERVER_UNAVAILABLE.code,
    MCP_ERRORS.TRANSPORT_ERROR.code,
    MCP_ERRORS.CONNECTION_CLOSED.code,
    WORKSPACE_ERRORS.CONTAINER_UNHEALTHY.code,
    WORKSPACE_ERRORS.PORT_ALLOCATION_FAILED.code
  ];
  
  return retryableCodes.includes(code);
}

/**
 * Get error by code
 * @param {number} code - Error code
 * @returns {Object|null} Error definition or null if not found
 */
function getErrorByCode(code) {
  const allErrors = {
    ...JSON_RPC_ERRORS,
    ...MCP_ERRORS,
    ...WORKSPACE_ERRORS
  };
  
  for (const key in allErrors) {
    if (allErrors[key].code === code) {
      return allErrors[key];
    }
  }
  
  return null;
}

module.exports = {
  // Error constants
  JSON_RPC_ERRORS,
  MCP_ERRORS,
  WORKSPACE_ERRORS,
  
  // Helper functions
  createErrorResponse,
  createServerError,
  isRetryableError,
  getErrorByCode,
  
  // All errors for easy access
  ALL_ERRORS: {
    ...JSON_RPC_ERRORS,
    ...MCP_ERRORS,
    ...WORKSPACE_ERRORS
  }
};

// Example usage:
/*
const { MCP_ERRORS, createServerError } = require('./error-codes');

// Create an error response for a failed server
const error = createServerError(
  MCP_ERRORS.SERVER_INITIALIZATION_FAILED,
  'github',
  'Failed to authenticate with GitHub API',
  'req-123'
);

console.log(JSON.stringify(error, null, 2));
// Output:
// {
//   "jsonrpc": "2.0",
//   "error": {
//     "code": -32002,
//     "message": "Server initialization failed",
//     "data": {
//       "server": "github",
//       "details": "Failed to authenticate with GitHub API"
//     }
//   },
//   "id": "req-123"
// }
*/