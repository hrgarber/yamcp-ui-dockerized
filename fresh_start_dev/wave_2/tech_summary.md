# Wave 2: Technology Summary

**Date**: 2025-01-23  
**Purpose**: Comprehensive context for wave_2 architecture decisions

## YAMCP Architecture

**Repository**: github.com/hamidra/yamcp

### Core Concepts
- **CLI tool** for organizing and managing MCP servers as local workspaces
- **Workspaces (YAMs)**: Collections of MCP servers grouped for specific purposes
- **Gateway**: Local MCP server that manages connections to configured servers and exposes them through a unified interface

### Key Components
- **McpGateway**: Core coordination component
- **GatewayServer**: Handles AI app communications
- **GatewayRouter**: Manages server connections
- **Centralized logging**: Tracks all server communications
- **Configuration store**: Manages providers and workspaces

### Workspace Organization
- By AI application (Cursor, Claude, GitHub Copilot)
- By workflow purpose (software development, data science)
- Flexible server grouping with JSON import/export

## YAMCP-UI Interface

**Repository**: github.com/eladcandroid/yamcp-ui

### Technical Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Lucide React
- **Backend**: Express.js
- **Build Tool**: Vite
- **Charting**: Recharts

### Key Features
- **Server Management**: Add, edit, and delete MCP servers
- **Workspace Management**: Create and manage workspaces with MCP configurations
- **Real-time Dashboard**: View system statistics and status
- **Log Viewing**: Monitor server logs and download log files
- **Modern UI**: Dark/light mode support, responsive design

### Configuration
- Stores settings in `.mcp.json` file
- Runs on `http://localhost:8765`
- Automatic YAMCP package installation if missing
- Secure localhost-only access with CORS protection

## SuperGateway Capabilities

**Repository**: github.com/supercorp-ai/supergateway

### Core Functionality
- **Protocol Conversion**: Transforms stdio MCP servers into:
  - Server-Sent Events (SSE)
  - WebSockets (WS)  
  - Streamable HTTP
- **Bidirectional**: Handles both stdio→protocol and protocol→stdio conversion

### Features
- **Authentication**: Headers and OAuth2 Bearer token support
- **Configuration**: Customizable ports, paths, transport modes
- **CORS Support**: For web client integration
- **Logging Control**: Adjustable log levels
- **Health Endpoints**: Built-in monitoring

### Deployment Options
- NPX-based local execution: `npx supergateway --stdio "mcp-server-command"`
- Docker images with various runtime dependencies
- Integration with ngrok for public access
- Stateless and stateful modes for different use cases

### Use Cases
- Remote debugging of MCP servers
- Exposing local servers publicly
- Connecting stdio-only servers to web clients
- Protocol-agnostic gateway solution

## Key Insight for Wave 2

The fundamental difference between wave_1 and wave_2:
- **Wave 1**: Each workspace container runs its own aggregation layer
- **Wave 2**: UI builds JSON configs, SuperGateway handles all MCP protocol work

This simplification keeps the UI container focused on user experience while leveraging SuperGateway's existing protocol conversion capabilities.