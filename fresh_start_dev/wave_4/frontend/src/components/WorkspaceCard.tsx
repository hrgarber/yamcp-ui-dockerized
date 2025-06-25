import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Trash2 } from 'lucide-react';
import { StatusDot } from './StatusDot';
import { toast } from 'sonner';
import type { WorkspaceStatus } from '@/api/workspaces';

interface WorkspaceCardProps {
  workspace: WorkspaceStatus & { name: string };
  onDelete: () => void;
}

export function WorkspaceCard({ workspace, onDelete }: WorkspaceCardProps) {
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