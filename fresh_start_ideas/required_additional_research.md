# Required Additional Research Questions

## Context and Background

**Project**: Building a cloud-native MCP (Model Context Protocol) hub that replicates YAMCP's workspace aggregation functionality

**Current Problem**: We have a working YAMCP-UI dashboard but the core `/mcp/:workspace` endpoint only spawns individual servers instead of aggregating them into a unified MCP endpoint. YAMCP CLI can aggregate multiple MCP servers into one endpoint (`yamcp run workspace-name`), but we need to replicate this in a networked/Docker environment.

**Goal**: Understand how to build a workspace gateway that takes multiple MCP servers and presents them as ONE unified MCP endpoint accessible via HTTP/SSE.

## Key Resources to Reference

**Primary Source**: 
- YAMCP GitHub: https://github.com/modelcontextprotocol/yamcp
- YAMCP npm package: https://www.npmjs.com/package/yamcp
- Look specifically at the CLI implementation and workspace aggregation logic

**Related Technologies**:
- MCP Protocol Specification: https://modelcontextprotocol.io/
- SuperGateway (MCP stdio→HTTP bridge): https://github.com/modelcontextprotocol/supergateway
- FastMCP (Python MCP framework): https://github.com/jlowin/fastmcp

**Current Understanding**:
- MCP uses JSON-RPC over stdio for server communication
- YAMCP aggregates multiple servers: `workspace → [server1, server2, server3] → unified endpoint`
- Our current implementation only uses the first server, missing the aggregation entirely

---

These questions need external research (via Perplexity) to understand YAMCP's workspace aggregation implementation and guide our cloud-native MCP hub development.

## YAMCP Core Architecture Questions

### 1. YAMCP Gateway Implementation Deep Dive
**Question**: How does YAMCP CLI implement workspace aggregation at the protocol level? Specifically:
- What is the exact JSON-RPC message routing mechanism when multiple MCP servers are combined?
- How does YAMCP handle tool discovery aggregation (combining `tools/list` responses from multiple servers)?
- What is the internal architecture for multiplexing requests to the correct server?

**Answer Format**: Technical implementation details with code examples if available. Focus on the gateway/aggregation logic, not the CLI wrapper.

### 2. Tool Namespace and Conflict Resolution
**Question**: How does YAMCP handle tool name conflicts when multiple servers provide the same tool name?
- Does it use prefixing (e.g., `context7/resolve-library-id`)?
- Does it use server priority/ordering?
- How are conflicting tool schemas handled?
- What happens with duplicate tool names in the unified tool list?

**Answer Format**: Specific conflict resolution strategies with examples of how tool names appear in the final aggregated list.

### 3. MCP Protocol Multiplexing
**Question**: What is YAMCP's exact approach to routing JSON-RPC calls between the client and multiple backend servers?
- How are request IDs managed across multiple servers?
- How does it handle async responses from different servers?
- What's the message flow for a typical tool call through the aggregator?
- How are errors from individual servers propagated back to the client?

**Answer Format**: Detailed protocol flow diagrams or pseudocode showing request routing and response handling.

## Alternative Solutions Research

### 4. FastMCP Aggregation Capabilities
**Question**: What are FastMCP's specific capabilities for server aggregation and proxying?
- How does `FastMCP.mount()` work for combining multiple servers?
- What does `FastMCP.as_proxy()` provide for proxying to remote MCP servers?
- Can FastMCP handle stdio-based servers or only network-based ones?
- Are there examples of FastMCP being used for workspace-style aggregation?

**Answer Format**: Code examples and architectural patterns for using FastMCP for multi-server aggregation.

### 5. SuperGateway Multi-Server Orchestration
**Question**: Can SuperGateway be used in a multi-instance setup for workspace aggregation?
- Can multiple SuperGateway instances be orchestrated behind a single aggregating proxy?
- What would be the network architecture for combining multiple SuperGateway endpoints?
- Are there existing patterns for building aggregators on top of SuperGateway?

**Answer Format**: Architecture patterns and feasibility assessment for SuperGateway-based aggregation.

## Implementation Strategy Questions

### 6. MCP Protocol Aggregation Best Practices
**Question**: What are the established patterns for building MCP protocol aggregators/gateways?
- Are there existing open-source implementations of MCP aggregators?
- What are the common pitfalls when building multi-server MCP gateways?
- How do other MCP implementations handle server multiplexing?

**Answer Format**: Best practices, existing implementations, and common architectural patterns.

### 7. Cloud-Native MCP Architecture
**Question**: What are the considerations for building networked/cloud-native MCP hubs vs local CLI tools?
- How should persistent connections be managed for multiple backend servers?
- What are the security implications of exposing MCP endpoints over HTTP/SSE?
- How should server health monitoring and failover be handled?
- What's the recommended approach for Docker deployment of MCP aggregators?

**Answer Format**: Architectural guidance for production MCP hub deployment with specific recommendations for persistence, security, and reliability.

## Research Priority
1. **HIGHEST**: Questions 1-3 (YAMCP implementation details) - Critical for replication
2. **HIGH**: Question 4 (FastMCP capabilities) - May provide ready-made solution
3. **MEDIUM**: Questions 5-7 (Implementation strategy) - Guides our approach

## How to Use These Answers
The research results will be used to:
1. Update `/fresh_start_ideas/` documentation with concrete implementation plans
2. Choose between FastMCP, custom implementation, or SuperGateway orchestration
3. Build the missing workspace aggregation functionality in `/server.mjs`
4. Ensure our cloud-native hub properly replicates YAMCP's core value proposition