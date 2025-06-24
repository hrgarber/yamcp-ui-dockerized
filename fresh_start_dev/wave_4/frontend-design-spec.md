# Wave 4 Frontend Design Specification

**Project**: YAMCP-UI Frontend Redesign  
**Date**: 2025-01-24  
**Tech Stack**: React + TypeScript + shadcn/ui + Tailwind CSS

## Executive Summary

This document specifies a complete frontend redesign for YAMCP-UI, transforming it from basic React components into a modern, production-ready interface using shadcn/ui components. The UI will provide intuitive workspace management for MCP (Model Context Protocol) server aggregation.

## Core Functionality

The frontend manages MCP workspaces where:
- Each workspace aggregates multiple MCP servers into a single endpoint
- Users can create, configure, monitor, and delete workspaces
- Workspaces run in Docker containers with health monitoring
- The UI communicates with an Express proxy that forwards to the Manager service

## Backend API Specification

### Base URL
```
http://localhost:3456/api
```

### Endpoints

#### 1. List Workspaces
```http
GET /api/workspaces
Response: {
  "workspaces": {
    "workspace-name": {
      "config": { /* workspace config */ },
      "status": "running" | "starting" | "unhealthy" | "stopped",
      "port": 9001,
      "url": "http://localhost:9001/sse",
      "health": {
        "status": "healthy" | "unhealthy",
        "lastCheck": "2025-01-24T10:00:00Z",
        "details": { /* health details */ }
      },
      "container": {
        "id": "abc123...",
        "name": "mcp-workspace-name"
      }
    }
  }
}
```

#### 2. Create/Update Workspace
```http
PUT /api/workspaces/:name
Content-Type: application/json
Body: {
  "name": "my-workspace",
  "servers": {
    "github": {
      "command": "mcp-server-github",
      "args": ["--token", "${GITHUB_TOKEN}"]
    },
    "filesystem": {
      "command": "mcp-server-filesystem",
      "args": ["--root", "/data"]
    }
  },
  "mcpServers": { /* legacy format also supported */ }
}
Response: {
  "success": true,
  "workspace": { /* workspace details */ }
}
```

#### 3. Delete Workspace
```http
DELETE /api/workspaces/:name
Response: {
  "success": true,
  "message": "Workspace deleted"
}
```

#### 4. Get Workspace Health
```http
GET /api/workspaces/:name/health
Response: {
  "status": "healthy" | "unhealthy",
  "checks": {
    "container": "ok" | "error",
    "port": "ok" | "error",
    "endpoint": "ok" | "error"
  },
  "details": { /* detailed health info */ }
}
```

## UI Components Architecture

### 1. Layout Structure
```
<AppLayout>
  <Header>
    - Logo/Title
    - Global Actions (Create Workspace button)
    - Theme Toggle
  </Header>
  
  <MainContent>
    <WorkspaceGrid> or <WorkspaceList>
      <WorkspaceCard /> (multiple)
    </WorkspaceGrid>
  </MainContent>
  
  <CreateWorkspaceDialog />
  <WorkspaceDetailsSheet />
</AppLayout>
```

### 2. Core Components

#### WorkspaceCard
- **Purpose**: Display workspace summary in grid/list
- **Features**:
  - Status indicator (color-coded dot with animations)
  - Name and description
  - Server count badge
  - Quick actions (view, edit, delete)
  - Health status with last check time
  - Connection URL (copyable)
- **shadcn components**: Card, Badge, Button, DropdownMenu, Tooltip

#### CreateWorkspaceDialog
- **Purpose**: Create/edit workspace configuration
- **Features**:
  - Multi-step form (Basic Info → Server Config → Review)
  - Template selection with preview
  - Dynamic server addition/removal
  - JSON editor with syntax highlighting
  - Validation with error messages
- **shadcn components**: Dialog, Form, Input, Select, Tabs, Button, Alert

#### WorkspaceDetailsSheet
- **Purpose**: Detailed workspace view
- **Features**:
  - Real-time status updates
  - Server list with individual health
  - Container logs viewer (virtualized)
  - Performance metrics charts
  - Configuration viewer/editor
  - Action buttons (restart, stop, delete)
- **shadcn components**: Sheet, Tabs, ScrollArea, Separator, Badge

#### ServerConfigForm
- **Purpose**: Configure individual MCP servers
- **Features**:
  - Server type selection (dropdown with icons)
  - Dynamic argument fields based on type
  - Environment variable management
  - Validation per server type
- **shadcn components**: Form, Input, Select, Label, Badge

#### StatusIndicator
- **Purpose**: Consistent status display
- **States**:
  - `running`: Green pulse animation
  - `starting`: Yellow spin animation
  - `unhealthy`: Red pulse
  - `stopped`: Gray static
- **Implementation**: CSS animations with Tailwind

### 3. Template System

Pre-built workspace templates:

```typescript
interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  tags: string[];
  config: WorkspaceConfig;
}

const templates: WorkspaceTemplate[] = [
  {
    id: "dev-environment",
    name: "Development Environment",
    description: "GitHub, filesystem, and database access",
    icon: "Code2",
    tags: ["development", "github", "database"],
    config: {
      name: "dev-env",
      servers: {
        github: { command: "mcp-server-github", args: ["--token", "${GITHUB_TOKEN}"] },
        filesystem: { command: "mcp-server-filesystem", args: ["--root", "/workspace"] },
        sqlite: { command: "mcp-server-sqlite", args: ["--db", "/data/dev.db"] }
      }
    }
  },
  {
    id: "data-science",
    name: "Data Science Workspace",
    description: "Python, Jupyter, and data tools",
    icon: "ChartBar",
    tags: ["data", "python", "analytics"],
    config: { /* ... */ }
  },
  {
    id: "automation",
    name: "Automation Hub",
    description: "Slack, email, and task automation",
    icon: "Bot",
    tags: ["automation", "slack", "integration"],
    config: { /* ... */ }
  },
  {
    id: "minimal",
    name: "Minimal Setup",
    description: "Just filesystem access",
    icon: "FileText",
    tags: ["simple", "filesystem"],
    config: { /* ... */ }
  }
];
```

## State Management

### React Query Setup
```typescript
// queries/workspaces.ts
export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
    refetchInterval: 5000, // Poll every 5s
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
};
```

### Zustand Store (for UI state)
```typescript
interface UIStore {
  selectedWorkspace: string | null;
  viewMode: 'grid' | 'list';
  isCreateDialogOpen: boolean;
  setSelectedWorkspace: (name: string | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setCreateDialogOpen: (open: boolean) => void;
}
```

## Styling Guidelines

### Color Scheme
```css
/* Status Colors */
--status-running: hsl(142, 76%, 36%);     /* green-600 */
--status-starting: hsl(45, 93%, 47%);     /* yellow-600 */
--status-unhealthy: hsl(0, 84%, 60%);     /* red-500 */
--status-stopped: hsl(0, 0%, 45%);        /* gray-500 */

/* Use CSS variables for easy theming */
```

### Animations
```typescript
// Framer Motion variants
export const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  hover: { scale: 1.02, transition: { duration: 0.2 } }
};

export const pulseAnimation = {
  scale: [1, 1.2, 1],
  opacity: [1, 0.8, 1],
  transition: { duration: 2, repeat: Infinity }
};
```

### Responsive Design
- Mobile: Single column, collapsible sections
- Tablet: 2-column grid
- Desktop: 3-4 column grid, side-by-side panels

## Features to Implement

### Phase 1: Core Functionality
1. Workspace CRUD operations
2. Template system
3. Real-time status updates
4. Basic health monitoring
5. Configuration validation

### Phase 2: Enhanced UX
1. Drag-and-drop server reordering
2. Bulk operations (stop all, restart all)
3. Workspace search and filtering
4. Keyboard shortcuts
5. Command palette (cmd+k)

### Phase 3: Advanced Features
1. Workspace metrics dashboard
2. Log streaming with filtering
3. Configuration history/versioning
4. Import/export configurations
5. Workspace sharing (future)

## Error Handling

### User-Friendly Error Messages
```typescript
const errorMessages: Record<string, string> = {
  'WORKSPACE_EXISTS': 'A workspace with this name already exists',
  'INVALID_CONFIG': 'The configuration is invalid. Please check your server settings',
  'DOCKER_ERROR': 'Unable to create container. Is Docker running?',
  'PORT_EXHAUSTED': 'No available ports. Please delete unused workspaces',
};
```

### Toast Notifications
```typescript
// Success
toast.success('Workspace created successfully');

// Error with action
toast.error('Failed to create workspace', {
  action: {
    label: 'Retry',
    onClick: () => handleRetry(),
  },
});
```

## Accessibility Requirements

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **ARIA Labels**: Proper labeling for screen readers
3. **Focus Management**: Logical focus flow, visible focus indicators
4. **Color Contrast**: WCAG AA compliance minimum
5. **Loading States**: Announce state changes to screen readers

## Performance Considerations

1. **Virtualization**: Use for long lists (logs, many workspaces)
2. **Code Splitting**: Lazy load heavy components (JSON editor, charts)
3. **Optimistic Updates**: Update UI before server confirms
4. **Debouncing**: Search and filter inputs
5. **Memoization**: Expensive computations and components

## Development Setup

```bash
# Required dependencies
npm install @radix-ui/react-* # shadcn/ui components
npm install tailwindcss @tailwindcss/forms @tailwindcss/typography
npm install @tanstack/react-query zustand
npm install framer-motion
npm install lucide-react
npm install react-hook-form zod @hookform/resolvers
npm install @monaco-editor/react # for JSON editing
npm install recharts # for metrics charts
npm install cmdk # for command palette
npm install sonner # for toasts
```

## File Structure
```
src/
  components/
    ui/              # shadcn/ui components
    workspace/       # Workspace-specific components
      WorkspaceCard.tsx
      WorkspaceGrid.tsx
      CreateWorkspaceDialog.tsx
      WorkspaceDetailsSheet.tsx
      ServerConfigForm.tsx
      StatusIndicator.tsx
    layout/          # Layout components
      AppLayout.tsx
      Header.tsx
  hooks/             # Custom hooks
    useWorkspaces.ts
    useWebSocket.ts
  queries/           # React Query queries
    workspaces.ts
  store/             # Zustand stores
    ui.ts
  utils/             # Utility functions
    api.ts
    validation.ts
  types/             # TypeScript types
    workspace.ts
```

## Example Implementation

### WorkspaceCard Component
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Copy, Edit, Trash } from "lucide-react";
import { StatusIndicator } from "./StatusIndicator";

interface WorkspaceCardProps {
  workspace: Workspace;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetails: () => void;
}

export function WorkspaceCard({ workspace, onEdit, onDelete, onViewDetails }: WorkspaceCardProps) {
  const serverCount = Object.keys(workspace.config.servers || {}).length;
  
  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {workspace.name}
              <StatusIndicator status={workspace.status} />
            </CardTitle>
            <CardDescription>
              {serverCount} server{serverCount !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Port</span>
            <Badge variant="outline">{workspace.port}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
              {workspace.url}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => navigator.clipboard.writeText(workspace.url)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Success Criteria

1. **Visual Appeal**: Modern, clean interface that feels premium
2. **Responsiveness**: Works flawlessly on all screen sizes
3. **Performance**: Instant UI updates, no lag
4. **Accessibility**: WCAG AA compliant
5. **Maintainability**: Well-organized, documented code
6. **User Experience**: Intuitive workflow, helpful feedback

## Notes for Implementation

- Start with the WorkspaceGrid and WorkspaceCard components
- Implement real-time updates early using React Query
- Use Storybook for component development
- Add comprehensive error boundaries
- Include loading skeletons for all async content
- Test on multiple browsers and devices
- Consider adding a dark mode from the start

This specification provides everything needed to build a professional, maintainable frontend for YAMCP-UI using modern React patterns and shadcn/ui components.