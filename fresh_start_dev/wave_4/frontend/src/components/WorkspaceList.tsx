import { useState } from 'react';
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
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
    },
    onError: () => {
      toast.error('Failed to delete workspace');
    }
  });

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const workspaces = data?.workspaces || {};

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MCP Workspaces</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Workspace
        </Button>
      </div>

      {Object.keys(workspaces).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No workspaces yet</p>
          <Button onClick={() => setShowCreate(true)}>
            Create your first workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(workspaces).map(([name, workspace]) => (
            <WorkspaceCard
              key={name}
              workspace={{ ...workspace, name }}
              onDelete={() => deleteMutation.mutate(name)}
            />
          ))}
        </div>
      )}

      <CreateWorkspace 
        open={showCreate} 
        onClose={() => setShowCreate(false)} 
      />
    </div>
  );
}