import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  servers: string[];
  status: string;
}

interface ServerData {
  id: string;
  name: string;
  type: "stdio" | "sse";
  status: string;
}

interface WorkspaceFormData {
  name: string;
  servers: string[];
}

interface WorkspaceFormErrors {
  name?: string;
  servers?: string;
}

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkspaceUpdated: () => void;
  workspace: WorkspaceData | null;
}

export function EditWorkspaceDialog({
  open,
  onOpenChange,
  onWorkspaceUpdated,
  workspace,
}: EditWorkspaceDialogProps) {
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: "",
    servers: [],
  });
  const [availableServers, setAvailableServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [errors, setErrors] = useState<WorkspaceFormErrors>({});

  // Populate form when workspace changes
  useEffect(() => {
    if (workspace) {
      setFormData({
        name: workspace.name,
        servers: [...workspace.servers],
      });
      setErrors({});
    }
  }, [workspace]);

  // Load available servers when dialog opens
  useEffect(() => {
    if (open) {
      loadServers();
    }
  }, [open]);

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const response = await fetch("/api/servers");
      if (response.ok) {
        const servers = await response.json();
        setAvailableServers(servers);
      } else {
        console.error("Failed to load servers");
      }
    } catch (error) {
      console.error("Error loading servers:", error);
    } finally {
      setLoadingServers(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: WorkspaceFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Workspace name is required";
    }

    if (formData.servers.length === 0) {
      newErrors.servers = "At least one server must be selected";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleServerToggle = (serverId: string) => {
    setFormData((prev) => ({
      ...prev,
      servers: prev.servers.includes(serverId)
        ? prev.servers.filter((id) => id !== serverId)
        : [...prev.servers, serverId],
    }));
  };

  const handleRemoveServer = (serverId: string) => {
    setFormData((prev) => ({
      ...prev,
      servers: prev.servers.filter((id) => id !== serverId),
    }));
  };

  const getServerById = (serverId: string) => {
    return availableServers.find((server) => server.id === serverId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !workspace) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          servers: formData.servers,
        }),
      });

      if (response.ok) {
        onWorkspaceUpdated();
        onOpenChange(false);
        // Reset form
        setFormData({
          name: "",
          servers: [],
        });
      } else {
        const error = await response.json();
        console.error("Failed to update workspace:", error);
        alert(`Failed to update workspace: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating workspace:", error);
      alert("Error updating workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
          <DialogDescription>
            Update the configuration for this workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter workspace name"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Selected Servers ({formData.servers.length})</Label>
              {formData.servers.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                  {formData.servers.map((serverId) => {
                    const server = getServerById(serverId);
                    return server ? (
                      <Badge
                        key={serverId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {server.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveServer(serverId)}
                          className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              ) : (
                <div className="p-4 border rounded-md text-center text-muted-foreground">
                  No servers selected
                </div>
              )}
              {errors.servers && (
                <p className="text-sm text-red-500">{errors.servers}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Available Servers</Label>
              {loadingServers ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading servers...
                </div>
              ) : availableServers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No servers available. Add some servers first.
                </div>
              ) : (
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  {availableServers.map((server) => (
                    <div
                      key={server.id}
                      className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-accent transition-colors ${
                        formData.servers.includes(server.id) ? "bg-accent" : ""
                      }`}
                      onClick={() => handleServerToggle(server.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.servers.includes(server.id)}
                            onChange={() => handleServerToggle(server.id)}
                            className="rounded"
                          />
                          <span className="font-medium">{server.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {server.type}
                          </Badge>
                        </div>
                        <Badge
                          variant={
                            server.status === "running"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {server.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || formData.servers.length === 0}
            >
              {loading ? "Updating..." : "Update Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
