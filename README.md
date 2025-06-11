# YAMCP UI Dashboard - Dockerized

> This is a dockerized fork of [yamcp-ui](https://github.com/eladcandroid/yamcp-ui) that runs in development mode, bypassing yamcp module compatibility issues.

A beautiful web-based dashboard for [YAMCP (Yet Another MCP)](https://github.com/hamidra/yamcp) - A Model Context Protocol workspace manager.

## Overview

YAMCP UI provides an intuitive web interface to manage your MCP servers, workspaces, and configurations. Built as a standalone npm package that integrates seamlessly with YAMCP.

## Demo

![YAMCP UI Demo](assets/demo/yamcp-ui-demo.gif)

## Features

- 🎛️ **Server Management**: Add, edit, and delete MCP servers
- 📁 **Workspace Management**: Create and manage workspaces with MCP configurations
- 📊 **Real-time Dashboard**: View statistics and system status
- 📝 **Log Viewing**: Monitor server logs and download log files
- 🎨 **Modern UI**: Beautiful interface with dark/light mode support
- 🔒 **Secure**: Localhost-only access with CORS protection

## Docker Installation & Usage (Recommended)

The easiest way to run YAMCP UI without dealing with dependencies:

```bash
# Clone this dockerized version
git clone https://github.com/hrgarber/yamcp-ui-dockerized.git
cd yamcp-ui-dockerized

# Run with Docker
cd docker
docker-compose up -d
```

Access the application:
- 🎨 **Frontend**: http://localhost:5173 (with hot reloading)
- 🔧 **Backend API**: http://localhost:8765

Stop the container:
```bash
docker-compose down
```

#### Building the Image Manually

If you prefer to build the Docker image directly without using Docker Compose:

```bash
# Navigate to the project root directory (yamcp-ui-dockerized)
docker build -t yamcp-ui-dev -f docker/Dockerfile .
```

Then you can run it using `docker run`, making sure to map ports and volumes as defined in the `docker-compose.yml`.
For example:
```bash
docker run -d -p 5173:5173 -p 8765:8765 \
  -v yamcp-ui-data:/root/.local/share/yamcp-nodejs \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/index.html:/app/index.html \
  -v $(pwd)/server.mjs:/app/server.mjs \
  --name yamcp-ui-dev-manual yamcp-ui-dev
```
Note: `$(pwd)` assumes you are in the project root.

### Benefits of Docker Version
- ✅ No yamcp installation required
- ✅ No module compatibility issues
- ✅ Hot reloading for development
- ✅ Isolated environment
- ✅ Easy to start and stop

## Original Installation & Usage (Non-Docker)

```bash
# Run directly with npx (recommended)
npx yamcp-ui

# Or install globally
npm install -g yamcp-ui
yamcp-ui
```

The dashboard will be available at `http://localhost:8765`

## Prerequisites

- Node.js 18.0.0 or higher
- YAMCP package (will be automatically installed if missing)

## Automatic YAMCP Installation

If YAMCP is not installed, yamcp-ui will offer to install it automatically:

```
⚠️  yamcp is not installed globally.

Would you like me to install yamcp for you? (Y/n): 
```

Simply press Enter or type 'y' to install the latest version of YAMCP.

## Development

```bash
# Clone the repository
git clone https://github.com/hrgarber/yamcp-ui-dockerized.git
cd yamcp-ui-dockerized

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```


## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Lucide React
- **Backend**: Express.js
- **Build Tool**: Vite
- **Charts**: Recharts

## Credits

### Created by
**Elad Cohen**  
LinkedIn: [https://www.linkedin.com/in/eladgocode/](https://www.linkedin.com/in/eladgocode/)

### Built on YAMCP by
**Hamid Alipour**  
GitHub: [https://github.com/hamidra](https://github.com/hamidra)  
YAMCP Repository: [https://github.com/hamidra/yamcp](https://github.com/hamidra/yamcp)

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues, please file them in the [GitHub Issues](https://github.com/eladcandroid/yamcp-ui/issues) section.
