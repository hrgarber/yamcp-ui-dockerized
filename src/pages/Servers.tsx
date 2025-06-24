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
import { AddServerDialog } from "@/components/AddServerDialog";
import { EditServerDialog } from "@/components/EditServerDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import { Server, Settings, Trash2, Plus, FileText } from "lucide-react";

interface ServerData {
  id: string;
  name: string;
  namespace: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export function Servers() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerData | null>(null);
  const [deletingServer, setDeletingServer] = useState<ServerData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/servers");
      if (response.ok) {
        const data = await response.json();
        setServers(data);
      } else {
        console.error("Failed to fetch servers");
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = () => {
    setShowAddDialog(true);
  };

  const handleEditServer = (server: ServerData) => {
    setEditingServer(server);
    setShowEditDialog(true);
  };

  const handleDeleteServer = (server: ServerData) => {
    setDeletingServer(server);
    setShowDeleteDialog(true);
  };

  const confirmDeleteServer = async () => {
    if (!deletingServer) return;

    try {
      setActionLoading(deletingServer.id);

      const response = await fetch(`/api/servers/${deletingServer.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        // Remove server from list
        setServers(servers.filter((server) => server.id !== deletingServer.id));
        setShowDeleteDialog(false);
        setDeletingServer(null);
      } else {
        const error = await response.json();
        console.error("Delete failed:", error.error);
        alert(`Delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error(`Error deleting server ${deletingServer.id}:`, error);
      alert(`Error deleting server: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>MCP Servers</CardTitle>
            <CardDescription>Loading servers...</CardDescription>
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
                <CardTitle>MCP Servers</CardTitle>
                <CardDescription>
                  All configured Model Context Protocol servers ({servers.length}{" "}
                  total)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowJsonEditor(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Edit providers.json
                </Button>
                <Button onClick={handleAddServer}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Server
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {servers.length === 0 ? (
              <div className="text-center py-8">
                <Server className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  No servers
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by adding your first MCP server.
                </p>
                <div className="mt-6">
                  <Button onClick={handleAddServer}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Server
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Namespace</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Configuration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servers.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell className="font-medium">
                        {server.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {server.namespace}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{server.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {server.type === "stdio"
                          ? `${server.command}${
                              server.args?.length
                                ? ` ${server.args.join(" ")}`
                                : ""
                            }`
                          : server.url}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditServer(server)}
                            disabled={actionLoading === server.id}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteServer(server)}
                            disabled={actionLoading === server.id}
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

      <AddServerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onServerAdded={fetchServers}
      />

      <EditServerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onServerUpdated={fetchServers}
        server={editingServer}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteServer}
        title="Delete Server"
        description="Are you sure you want to delete this server?"
        itemName={deletingServer?.name || ""}
        itemType="server"
        isLoading={actionLoading === deletingServer?.id}
      />

      <JsonEditorDialog
        open={showJsonEditor}
        onOpenChange={setShowJsonEditor}
        title="Edit providers.json"
        description="Edit the raw providers configuration file. Be careful when making changes."
        endpoint="/api/config/providers"
        onSaved={fetchServers}
      />
    </>
  );
}
