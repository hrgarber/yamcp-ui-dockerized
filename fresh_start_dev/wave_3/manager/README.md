# YAMCP Manager Service

Node.js service for orchestrating Docker containers that run MCP workspace aggregations.

## Features

- Docker container lifecycle management
- Dynamic port allocation and tracking
- Health monitoring with automatic recovery
- Configuration validation
- RESTful API for UI integration

## Architecture

The manager service is responsible for:

1. **Container Management**: Creating, starting, stopping, and removing Docker containers
2. **Port Management**: Allocating unique ports for each workspace
3. **Health Monitoring**: Regular health checks and automatic container restart
4. **Configuration**: Validating and converting workspace configurations to container environment

## Prerequisites

- Node.js 18+
- Docker Engine
- Access to Docker daemon socket

## Installation

```bash
npm install
```

## Development

```bash
# Run with auto-reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## API Endpoints

- `POST /workspaces` - Create a new workspace
- `GET /workspaces` - List all workspaces
- `GET /workspaces/:id` - Get workspace details
- `PUT /workspaces/:id` - Update workspace configuration
- `DELETE /workspaces/:id` - Delete a workspace
- `GET /health` - Service health check

## Configuration

Environment variables:

- `PORT` - Service port (default: 3001)
- `DOCKER_SOCKET` - Docker socket path (default: /var/run/docker.sock)
- `WORKSPACE_IMAGE` - Docker image for workspaces
- `PORT_RANGE_START` - Start of port allocation range (default: 8100)
- `PORT_RANGE_END` - End of port allocation range (default: 8200)
- `HEALTH_CHECK_INTERVAL` - Health check interval in ms (default: 30000)
- `MAX_RESTART_ATTEMPTS` - Maximum restart attempts (default: 3)

## Directory Structure

```
manager/
├── index.js              # Main entry point
├── docker-client.js      # Docker container management
├── config-validator.js   # Configuration validation
├── port-manager.js       # Port allocation
├── health-monitor.js     # Health monitoring
├── *.test.js            # Unit tests
├── package.json         # Dependencies
└── README.md           # This file
```

## Testing

Tests are written using Jest and follow the naming convention `*.test.js`. Each module has a corresponding test file that covers its functionality.

## License

MIT