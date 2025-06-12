# MCP SSE Protocol Specification

**Status**: Complete  
**Research Date**: 2025-01-11

## Overview

This document provides the exact MCP (Model Context Protocol) SSE (Server-Sent Events) wire format specification based on research into the official MCP protocol.

## Key Findings

MCP uses **JSON-RPC 2.0** over **HTTP + SSE** transport, where:
- HTTP is used for client → server requests
- SSE is used for server → client streaming responses
- All messages follow JSON-RPC 2.0 specification exactly

## SSE Transport Headers

SSE responses must include these HTTP headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## SSE Event Format

SSE events use line-based format with double newline termination:

```
event: [event_type]
data: [json_rpc_message]
id: [optional_event_id]
retry: [optional_reconnect_milliseconds]

```

## JSON-RPC 2.0 Message Types

### 1. Requests (Client → Server)
```json
{
  "jsonrpc": "2.0",
  "id": "unique_request_id",
  "method": "method_name",
  "params": {
    // optional parameters object
  }
}
```

### 2. Responses (Server → Client)
```json
{
  "jsonrpc": "2.0",
  "id": "matching_request_id",
  "result": {
    // success result data
  }
}
```

### 3. Error Responses
```json
{
  "jsonrpc": "2.0",
  "id": "matching_request_id",
  "error": {
    "code": -32000,
    "message": "Human readable error",
    "data": {
      // optional additional error context
    }
  }
}
```

### 4. Notifications (No Response Expected)
```json
{
  "jsonrpc": "2.0",
  "method": "notification_method",
  "params": {
    // optional parameters
  }
}
```

## Wire Format Examples

### Tool Discovery Request
```
POST /mcp/workspace
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list"
}
```

### Tool Discovery Response (via SSE)
```
event: response
data: {"jsonrpc":"2.0","id":"1","result":{"tools":[{"name":"github/list_issues","description":"List GitHub issues"}]}}

```

### Tool Call Request
```
POST /mcp/workspace
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "2", 
  "method": "tools/call",
  "params": {
    "name": "github/list_issues",
    "arguments": {
      "repo": "user/repo"
    }
  }
}
```

### Tool Call Response (via SSE)
```
event: response
data: {"jsonrpc":"2.0","id":"2","result":{"content":[{"type":"text","text":"Issue list: ..."}]}}

```

### Error Response (via SSE)
```
event: response
data: {"jsonrpc":"2.0","id":"3","error":{"code":-32603,"message":"GitHub API rate limit exceeded","data":{"retry_after":3600}}}

```

### Lifecycle Notification (via SSE)
```
event: lifecycle
data: {"jsonrpc":"2.0","method":"streamOpened","params":{"timestamp":"2025-01-11T12:00:00Z"}}

```

## Connection Lifecycle

### 1. Initial Connection
1. Client opens SSE connection to `/mcp/:workspace`
2. Server sends `streamOpened` notification
3. Connection ready for JSON-RPC messages

### 2. Request/Response Flow
1. Client sends HTTP POST with JSON-RPC request
2. Server processes and sends response via SSE
3. ID correlation matches requests to responses

### 3. Heartbeat/Keepalive
Server may send periodic notifications:
```
event: lifecycle
data: {"jsonrpc":"2.0","method":"ping","params":{"timestamp":"2025-01-11T12:01:00Z"}}

```

### 4. Connection Termination
Server sends final notification before closing:
```
event: lifecycle
data: {"jsonrpc":"2.0","method":"streamClosed","params":{"reason":"shutdown"}}

```

## Error Code Conventions

Standard JSON-RPC 2.0 error codes:
- `-32700`: Parse error (invalid JSON)
- `-32600`: Invalid request (malformed JSON-RPC)
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000` to `-32099`: Server-defined errors

## Critical Implementation Details

### Message ID Management
- Each request must have unique, non-null ID
- Response ID must exactly match request ID
- Notifications have no ID field
- IDs should not be reused in same session

### SSE Event Types
- `response`: For request responses and errors
- `notification`: For server-initiated notifications
- `lifecycle`: For connection management events

### Bidirectional Communication
- Client → Server: HTTP POST requests
- Server → Client: SSE events
- SSE is unidirectional (server to client only)

## Validation Requirements

### Message Validation
1. Must include `"jsonrpc": "2.0"`
2. Requests must have non-null `id`
3. Responses must echo request `id`
4. Either `result` OR `error`, never both
5. Error must have `code` and `message`

### SSE Validation
1. Proper event format with double newline
2. Valid JSON in `data` field
3. Optional but recommended `event` type
4. Proper HTTP headers for SSE transport

## FastMCP Compatibility Notes

Based on research, FastMCP implements this specification correctly:
- Supports SSE transport
- Uses proper JSON-RPC 2.0 format
- Handles request ID correlation
- Provides proper error responses

This makes FastMCP compatible with MCP clients like smolagents without protocol adaptation.