import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi, WorkspaceConfig } from '@/api/workspaces';
import { toast } from 'sonner';

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

interface CreateWorkspaceProps {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkspace({ open, onClose }: CreateWorkspaceProps) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('minimal');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: ({ name, config }: { name: string; config: WorkspaceConfig }) => 
      workspaceApi.create(name, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
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
    const config: WorkspaceConfig = {
      name,
      ...TEMPLATES[template].config
    };
    createMutation.mutate({ name, config });
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
                  onClick={() => setTemplate(key as keyof typeof TEMPLATES)}
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