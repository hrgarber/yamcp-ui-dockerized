# Simplified Frontend Implementation Guide

**Goal**: Build a clean, functional UI for MCP workspace management without overengineering.

## Quick Start (30 minutes to working UI)

### 1. Install Dependencies (one command)
```bash
npm install @tanstack/react-query lucide-react sonner
npx shadcn-ui@latest init
npx shadcn-ui@latest add card button badge dialog form input select dropdown-menu
```

### 2. Basic Project Structure (keep it flat)
```
src/
  components/
    WorkspaceList.tsx      # Main view
    WorkspaceCard.tsx      # Individual workspace
    CreateWorkspace.tsx    # Create/edit form
    StatusDot.tsx          # Simple status indicator
  api/
    workspaces.ts          # All API calls
  App.tsx                  # Main app
```

## Core Implementation (MVP in 2 hours)

### Step 1: API Client (15 min)
```typescript
// src/api/workspaces.ts
const API_BASE = 'http://localhost:3456/api';

export const workspaceApi = {
  list: () => fetch(`${API_BASE}/workspaces`).then(r => r.json()),
  create: (name: string, config: any) => 
    fetch(`${API_BASE}/workspaces/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json()),
  delete: (name: string) => 
    fetch(`${API_BASE}/workspaces/${name}`, { method: 'DELETE' })
};
```

### Step 2: Main Component (30 min)
```tsx
// src/components/WorkspaceList.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceCard } from './WorkspaceCard';
import { CreateWorkspace } from './CreateWorkspace';
import { workspaceApi } from '@/api/workspaces';
import { toast } from 'sonner';

export function WorkspaceList() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
    refetchInterval: 5000
  });

  const deleteMutation = useMutation({
    mutationFn: workspaceApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['workspaces']);
      toast.success('Workspace deleted');
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MCP Workspaces</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Workspace
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.workspaces || {}).map(([name, workspace]) => (
          <WorkspaceCard
            key={name}
            workspace={workspace}
            onDelete={() => deleteMutation.mutate(name)}
          />
        ))}
      </div>

      <CreateWorkspace 
        open={showCreate} 
        onClose={() => setShowCreate(false)} 
      />
    </div>
  );
}
```

### Step 3: Workspace Card (20 min)
```tsx
// src/components/WorkspaceCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Trash2 } from 'lucide-react';
import { StatusDot } from './StatusDot';
import { toast } from 'sonner';

export function WorkspaceCard({ workspace, onDelete }) {
  const copyUrl = () => {
    navigator.clipboard.writeText(workspace.url);
    toast.success('URL copied!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {workspace.name}
            <StatusDot status={workspace.status} />
          </span>
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Port</span>
            <Badge variant="outline">{workspace.port}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-1 rounded text-xs truncate">
              {workspace.url}
            </code>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyUrl}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 4: Create Dialog (25 min)
```tsx
// src/components/CreateWorkspace.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '@/api/workspaces';
import { toast } from 'sonner';

// Simple templates - no need for complex system
const TEMPLATES = {
  minimal: {
    name: "Minimal",
    config: {
      servers: {
        filesystem: {
          command: "mcp-server-filesystem",
          args: ["--root", "/workspace"]
        }
      }
    }
  },
  development: {
    name: "Development",
    config: {
      servers: {
        github: {
          command: "mcp-server-github",
          args: ["--token", "${GITHUB_TOKEN}"]
        },
        filesystem: {
          command: "mcp-server-filesystem",
          args: ["--root", "/workspace"]
        }
      }
    }
  }
};

export function CreateWorkspace({ open, onClose }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('minimal');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: ({ name, config }) => workspaceApi.create(name, config),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspaces']);
      toast.success('Workspace created!');
      onClose();
      setName('');
    },
    onError: () => {
      toast.error('Failed to create workspace');
    }
  });

  const handleCreate = () => {
    if (!name) {
      toast.error('Please enter a name');
      return;
    }
    createMutation.mutate({
      name,
      config: TEMPLATES[template].config
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-workspace"
            />
          </div>
          
          <div>
            <Label>Template</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                <Button
                  key={key}
                  variant={template === key ? "default" : "outline"}
                  onClick={() => setTemplate(key)}
                >
                  {tmpl.name}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            Create Workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 5: Status Indicator (10 min)
```tsx
// src/components/StatusDot.tsx
export function StatusDot({ status }) {
  const colors = {
    running: 'bg-green-500',
    starting: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
    stopped: 'bg-gray-500'
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.stopped}`} />
  );
}
```

### Step 6: Wire it up (10 min)
```tsx
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { WorkspaceList } from './components/WorkspaceList';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceList />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

export default App;
```

## That's It! 

You now have:
- ✅ List all workspaces with auto-refresh
- ✅ Create workspaces from templates  
- ✅ Delete workspaces
- ✅ Show status with colored dots
- ✅ Copy workspace URLs
- ✅ Toast notifications

## Optional Enhancements (add only if needed)

### 1. Edit Workspace (15 min)
Reuse the CreateWorkspace component with initial values.

### 2. Better Templates (10 min)
Add more templates to the TEMPLATES object.

### 3. Error Details (10 min)
Show specific error messages from the API.

### 4. Dark Mode (5 min)
Add `dark` class toggle to `<html>` element.

## What We Skipped (and why)

1. **Complex State Management**: React Query handles server state, component state is enough for UI
2. **Multi-step Forms**: Simple single form is clearer
3. **Animations**: CSS transitions are sufficient
4. **Charts/Metrics**: Not needed for MVP
5. **Virtualization**: Won't have that many workspaces
6. **Command Palette**: Overkill for this use case

## Development Tips

1. **Start with the API client** - Make sure backend connection works
2. **Use React Query** - Handles caching, refetching, loading states
3. **Keep components small** - Each component should do one thing
4. **Use shadcn/ui defaults** - Don't overthink styling
5. **Add features incrementally** - Ship MVP first

## Total Time: ~2 hours for fully functional UI

This approach gives you everything you need without the complexity. The UI will be clean, responsive, and maintainable.