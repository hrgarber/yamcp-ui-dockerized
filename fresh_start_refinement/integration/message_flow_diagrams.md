# Message Flow Diagrams

**Status**: Complete  
**Created**: 2025-01-11

## Overview

This document provides visual representations of message flows through our system architecture.

## 1. Complete Request/Response Flow

```
[MCP Client]
     │
     │ (1) HTTP GET /mcp/workspace + SSE
     ▼
[Express API Gateway]
     │
     │ (2) Initialize SSE connection
     ▼
[MCP SSE Handler]
     │
     │ (3) HTTP POST with JSON-RPC
     ▼
[FastMCP Bridge]
     │
     │ (4) HTTP POST to localhost:8080
     ▼
[FastMCP HTTP Server] ◄─┐
     │                   │
     │ (5) Route by prefix │ (6) Aggregate responses
     ▼                   │
[Individual MCP Servers]─┘
```

## 2. Tool Discovery Flow

```
Client                   Express              FastMCP            MCP Servers
  │                         │                   │                     │
  │ GET /mcp/workspace      │                   │                     │
  │ Accept: text/event-stream│                   │                     │
  ├────────────────────────►│                   │                     │
  │                         │                   │                     │
  │ SSE: data: connected    │                   │                     │
  │◄────────────────────────┤                   │                     │
  │                         │                   │                     │
  │ POST {"method":"tools/list"}                │                     │
  ├────────────────────────►│                   │                     │
  │                         │ POST /mcp         │                     │
  │                         ├──────────────────►│                     │
  │                         │                   │ get_tools()         │
  │                         │                   ├────────────────────►│
  │                         │                   │ tools: [list_files] │
  │                         │                   │◄────────────────────┤
  │                         │                   │ get_tools()         │
  │                         │                   ├────────────────────►│
  │                         │                   │ tools: [list_issues]│
  │                         │                   │◄────────────────────┤
  │                         │ response: tools   │                     │
  │                         │◄──────────────────┤                     │
  │ SSE: aggregated tools   │                   │                     │
  │◄────────────────────────┤                   │                     │
```

## 3. Tool Call Flow with Namespace Resolution

```
Client Request: {"method":"tools/call","params":{"name":"github/list_issues"}}
                                │
                                ▼
Express Gateway: Route to workspace FastMCP instance
                                │
                                ▼
FastMCP Bridge: HTTP POST to localhost:8080/mcp
                                │
                                ▼
FastMCP Server: Parse tool name "github/list_issues"
                                │
                                ▼
FastMCP Router: prefix="github", tool="list_issues"
                                │
                                ▼
GitHub MCP Server: execute list_issues()
                                │
                                ▼
FastMCP Server: prefix response with "github"
                                │
                                ▼
FastMCP Bridge: return response to Express
                                │
                                ▼
Express Gateway: send via SSE to client
                                │
                                ▼
Client: receives aggregated response
```

## 4. Error Propagation Flow

```
Error Source              Detection              Recovery              User Notification
     │                       │                      │                        │
MCP Server Crash ──────► Process Monitor ────► Auto-restart ────────► SSE notification
     │                       │                      │                        │
FastMCP HTTP Error ────► Bridge Exception ───► Retry logic ────────► Error response
     │                       │                      │                        │
Config Invalid ───────► Validation Check ──► Use defaults ───────► Warning message
     │                       │                      │                        │
Network Timeout ──────► HTTP timeout ───────► Exponential backoff ► "Retrying..." message
```

## 5. Workspace Lifecycle Flow

```
User Action                System Response              State Changes
     │                          │                           │
Create Workspace ──────────► Validate Config ─────────► config.status = "valid"
     │                          │                           │
     ▼                          ▼                           ▼
Start Workspace ───────────► Spawn FastMCP ──────────► process.status = "starting"
     │                          │                           │
     ▼                          ▼                           ▼
FastMCP Ready ─────────────► Health Check ────────────► process.status = "running"
     │                          │                           │
     ▼                          ▼                           ▼
Connect Client ────────────► SSE Connection ──────────► connection.count++
     │                          │                           │
     ▼                          ▼                           ▼
Config Change ─────────────► Hot Reload ──────────────► Graceful restart
     │                          │                           │
     ▼                          ▼                           ▼
Stop Workspace ────────────► Cleanup Resources ───────► process.status = "stopped"
```

## 6. Configuration Hot Reload Flow

```
File System                Configuration Manager        Workspace Manager         Clients
     │                            │                          │                      │
Config Change ─────────────────► File Watcher ───────────► configChanged event ──► Notify pending
     │                            │                          │                      │
     ▼                            ▼                          ▼                      ▼
Validate New Config ────────────► Schema Check ────────────► Lock workspace ──────► SSE: "restarting"
     │                            │                          │                      │
     ▼                            ▼                          ▼                      ▼
If Valid ───────────────────────► Save Parsed Config ──────► Stop FastMCP ────────► SSE: "stopped"
     │                            │                          │                      │
     ▼                            ▼                          ▼                      ▼
Transform to FastMCP ───────────► New Config Ready ────────► Start FastMCP ───────► SSE: "starting"
     │                            │                          │                      │
     ▼                            ▼                          ▼                      ▼
FastMCP Online ─────────────────► Health Check ────────────► Unlock workspace ────► SSE: "ready"
```

## 7. Multi-Client Connection Management

```
Client A          Client B          SSE Handler          Workspace Process
    │                 │                  │                      │
    │ Connect         │                  │                      │
    ├────────────────►│                  │                      │
    │                 │ connection_a     │                      │
    │                 ├─────────────────►│                      │
    │                 │                  │ workspace.clients++  │
    │                 │                  ├─────────────────────►│
    │                 │ Connect          │                      │
    │                 ├─────────────────►│                      │
    │                 │ connection_b     │                      │
    │                 │                  │ workspace.clients++  │
    │                 │                  ├─────────────────────►│
    │ Tool Call       │                  │                      │
    ├────────────────►│                  │                      │
    │                 │ request_id_1     │                      │
    │                 ├─────────────────►│                      │
    │                 │                  │ forward to FastMCP   │
    │                 │                  ├─────────────────────►│
    │                 │ Tool Call        │                      │
    │                 ├─────────────────►│                      │
    │                 │ request_id_2     │                      │
    │                 │                  │ queue request        │
    │                 │                  ├─────────────────────►│
    │ Response        │                  │                      │
    │◄────────────────┤                  │                      │
    │                 │ response_id_1    │                      │
    │                 │◄─────────────────┤                      │
    │                 │ Response         │                      │
    │                 │◄─────────────────┤                      │
    │                 │ response_id_2    │                      │
```

## 8. State Synchronization Flow

```
Component A               Event Bus                Component B               Component C
     │                       │                         │                        │
State Change ──────────────► emit(event) ─────────────► event handler ────────► Update state
     │                       │                         │                        │
     ▼                       ▼                         ▼                        ▼
Process.status = "error" ──► process/error ───────────► Show error UI ────────► Log error
     │                       │                         │                        │
     ▼                       ▼                         ▼                        ▼
Auto-restart ──────────────► process/starting ───────► Update UI ─────────────► Clear error log
     │                       │                         │                        │
     ▼                       ▼                         ▼                        ▼
Process.status = "running" ─► process/started ────────► Show ready UI ────────► Log success
```

## 9. Resource Management Flow

```
Request                  Resource Manager            Process Spawner           System Monitor
   │                          │                           │                        │
Need Port ──────────────────► Check available ──────────► Allocate port ────────► Update usage
   │                          │                           │                        │
   ▼                          ▼                           ▼                        ▼
Port 8080 ──────────────────► Mark allocated ───────────► Bind process ─────────► Track process
   │                          │                           │                        │
   ▼                          ▼                           ▼                        ▼
Process Start ──────────────► Update registry ──────────► Monitor health ───────► Report metrics
   │                          │                           │                        │
   ▼                          ▼                           ▼                        ▼
Process Stop ───────────────► Release port ─────────────► Cleanup ──────────────► Update metrics
```

## 10. Circuit Breaker State Transitions

```
Normal Operation ────┐
     │               │
     ▼               │
[CLOSED] ────────────┘
     │ (failure)
     ▼
Increment counter
     │
     ▼
Counter >= threshold? ──No──► Continue [CLOSED]
     │ Yes
     ▼
[OPEN] ◄──────────── Fast fail all requests
     │ (timeout expired)
     ▼
[HALF-OPEN]
     │
     ├─ Success ──────► Reset counter ──► [CLOSED]
     │
     └─ Failure ──────► [OPEN]
```

## Message Correlation

### Request ID Tracking
```
Client Request ID: "abc123"
     │
     ▼
Express: correlation_id = "abc123", internal_id = uuid()
     │
     ▼
FastMCP: preserve correlation_id, add fastmcp_id = uuid()
     │
     ▼
MCP Server: preserve all IDs, add server_request_id = uuid()
     │
     ▼ (Response)
FastMCP: match fastmcp_id, return correlation_id
     │
     ▼
Express: match internal_id, return correlation_id
     │
     ▼
Client: receive response with original ID "abc123"
```

### Timeout Handling
```
Request starts ──► Set timeout timer ──► Timer expires ──► Cancel request
     │                      │                    │              │
     ▼                      ▼                    ▼              ▼
Response received ──► Clear timer ────► Success ────► Return response
```

These message flows provide clear visualization of how data moves through our system and how different components interact during various operations.