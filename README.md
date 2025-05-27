# YAMCP UI Dashboard

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

## Installation & Usage

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
git clone https://github.com/eladcandroid/yamcp-ui.git
cd yamcp-ui

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