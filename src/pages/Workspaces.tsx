import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddWorkspaceDialog } from "@/components/AddWorkspaceDialog";
import { EditWorkspaceDialog } from "@/components/EditWorkspaceDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { WorkspaceConfigDialog } from "@/components/WorkspaceConfigDialog";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import {
  FolderOpen,
  Eye,
  Settings,
  Trash2,
  Plus,
  FileText,
} from "lucide-react";

interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  servers: string[];
  status: string;
}

export function Workspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [editingWorkspace, setEditingWorkspace] =
    useState<WorkspaceData | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] =
    useState<WorkspaceData | null>(null);
  const [viewingWorkspace, setViewingWorkspace] =
    useState<WorkspaceData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
      } else {
        console.error("Failed to fetch workspaces");
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = () => {
    setShowAddDialog(true);
  };

  const handleEditWorkspace = (workspace: WorkspaceData) => {
    setEditingWorkspace(workspace);
    setShowEditDialog(true);
  };

  const handleShowConfig = (workspace: WorkspaceData) => {
    setViewingWorkspace(workspace);
    setShowConfigDialog(true);
  };

  const handleDeleteWorkspace = (workspace: WorkspaceData) => {
    setDeletingWorkspace(workspace);
    setShowDeleteDialog(true);
  };

  const confirmDeleteWorkspace = async () => {
    if (!deletingWorkspace) return;

    try {
      setActionLoading(deletingWorkspace.id);

      const response = await fetch(`/api/workspaces/${deletingWorkspace.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        // Remove workspace from list
        setWorkspaces(
          workspaces.filter(
            (workspace) => workspace.id !== deletingWorkspace.id
          )
        );
        setShowDeleteDialog(false);
        setDeletingWorkspace(null);
      } else {
        const error = await response.json();
        console.error("Delete failed:", error.error);
        alert(`Delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error(`Error deleting workspace ${deletingWorkspace.id}:`, error);
      alert(`Error deleting workspace: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Loading workspaces...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-200 rounded animate-pulse"
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workspaces</CardTitle>
                <CardDescription>
                  Grouped server configurations for different use cases (
                  {workspaces.length} total)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowJsonEditor(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Edit workspaces.json
                </Button>
                <Button onClick={handleCreateWorkspace}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workspace
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {workspaces.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  No workspaces
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first workspace to group servers.
                </p>
                <div className="mt-6">
                  <Button onClick={handleCreateWorkspace}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Workspace
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Servers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell className="font-medium">
                        {workspace.name}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {workspace.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {workspace.servers.length > 0 ? (
                            workspace.servers.map((server) => (
                              <Badge
                                key={server}
                                variant="outline"
                                className="text-xs"
                              >
                                {server}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No servers
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowConfig(workspace)}
                            disabled={actionLoading === workspace.id}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditWorkspace(workspace)}
                            disabled={actionLoading === workspace.id}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWorkspace(workspace)}
                            disabled={actionLoading === workspace.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AddWorkspaceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onWorkspaceAdded={fetchWorkspaces}
      />

      <EditWorkspaceDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onWorkspaceUpdated={fetchWorkspaces}
        workspace={editingWorkspace}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteWorkspace}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace?"
        itemName={deletingWorkspace?.name || ""}
        itemType="workspace"
        isLoading={actionLoading === deletingWorkspace?.id}
      />

      <WorkspaceConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        workspace={viewingWorkspace}
      />

      <JsonEditorDialog
        open={showJsonEditor}
        onOpenChange={setShowJsonEditor}
        title="Edit workspaces.json"
        description="Edit the raw workspaces configuration file. Be careful when making changes."
        endpoint="/api/config/workspaces"
        onSaved={fetchWorkspaces}
      />
    </>
  );
}
