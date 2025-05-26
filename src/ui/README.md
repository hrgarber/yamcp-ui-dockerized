# YAMCP Dashboard UI

A modern React-based dashboard for managing YAMCP (Yet Another MCP) servers and workspaces.

## Features

- **Dashboard Overview**: View statistics and recent activity
- **Server Management**: Start, stop, configure, and monitor MCP servers
- **Workspace Management**: Create and manage server workspaces
- **Log Viewer**: View system logs and server events
- **Responsive Design**: Works on desktop and mobile devices

## Usage

### Starting the Dashboard

From the main YAMCP directory:

```bash
# Start on default port (3000) and open browser
yamcp ui

# Start on custom port
yamcp ui --port 8080

# Start without opening browser
yamcp ui --no-open
```

### Development

To work on the UI components:

```bash
cd src/ui

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

- **Frontend**: React + Vite + TypeScript
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Express.js server
- **API**: RESTful endpoints for server/workspace management

## API Endpoints

- `GET /api/stats` - Dashboard statistics
- `GET /api/servers` - List all servers
- `GET /api/workspaces` - List all workspaces
- `GET /api/logs` - System logs
- `POST /api/servers/:id/start` - Start a server
- `POST /api/servers/:id/stop` - Stop a server
- `DELETE /api/servers/:id` - Delete a server
- `POST /api/workspaces/:id/start` - Start workspace
- `POST /api/workspaces/:id/stop` - Stop workspace
- `DELETE /api/workspaces/:id` - Delete workspace

## File Structure

```
src/ui/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   └── Layout.tsx   # Main layout component
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Servers.tsx
│   │   ├── Workspaces.tsx
│   │   └── Logs.tsx
│   ├── lib/
│   │   └── utils.ts     # Utility functions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── server.cjs           # Express server
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Integration with YAMCP

The UI currently uses mock data for demonstration. To integrate with real YAMCP data:

1. Replace mock data in `server.cjs` with calls to YAMCP core functions
2. Import YAMCP modules for server/workspace management
3. Connect to actual log files and configuration stores
4. Implement real-time updates using WebSockets or Server-Sent Events

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Lucide React** - Icons
- **React Router** - Client-side routing
- **Express.js** - Backend server 