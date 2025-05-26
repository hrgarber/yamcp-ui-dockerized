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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ServerData {
  id: string;
  name: string;
  type: "stdio" | "sse";
  status: string;
  command?: string;
  args?: string[];
  url?: string;
  lastSeen: string;
}

interface ServerFormData {
  name: string;
  type: "stdio" | "sse";
  command: string;
  args: string;
  url: string;
}

interface ServerFormErrors {
  name?: string;
  command?: string;
  url?: string;
}

interface EditServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerUpdated: () => void;
  server: ServerData | null;
}

export function EditServerDialog({
  open,
  onOpenChange,
  onServerUpdated,
  server,
}: EditServerDialogProps) {
  const [formData, setFormData] = useState<ServerFormData>({
    name: "",
    type: "stdio",
    command: "",
    args: "",
    url: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ServerFormErrors>({});

  // Populate form when server changes
  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        type: server.type,
        command: server.command || "",
        args: server.args?.join(" ") || "",
        url: server.url || "",
      });
      setErrors({});
    }
  }, [server]);

  const validateForm = (): boolean => {
    const newErrors: ServerFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Server name is required";
    }

    if (formData.type === "stdio") {
      if (!formData.command.trim()) {
        newErrors.command = "Command is required for stdio servers";
      }
    } else if (formData.type === "sse") {
      if (!formData.url.trim()) {
        newErrors.url = "URL is required for SSE servers";
      } else if (!formData.url.startsWith("http")) {
        newErrors.url = "URL must start with http:// or https://";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !server) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        ...(formData.type === "stdio"
          ? {
              command: formData.command,
              args: formData.args
                .split(" ")
                .map((arg) => arg.trim())
                .filter((arg) => arg.length > 0),
            }
          : {
              url: formData.url,
            }),
      };

      const response = await fetch(`/api/servers/${server.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onServerUpdated();
        onOpenChange(false);
        // Reset form
        setFormData({
          name: "",
          type: "stdio",
          command: "",
          args: "",
          url: "",
        });
      } else {
        const error = await response.json();
        console.error("Failed to update server:", error);
        alert(`Failed to update server: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating server:", error);
      alert("Error updating server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setErrors({});
  };

  const handleTypeChange = (value: "stdio" | "sse") => {
    setFormData((prev) => ({ ...prev, type: value }));
    // Clear type-specific errors when switching
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.command;
      delete newErrors.url;
      return newErrors;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Server</DialogTitle>
          <DialogDescription>
            Update the configuration for this MCP server.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter server name"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Server Type</Label>
              <Select value={formData.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select server type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">STDIO</SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === "stdio" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="command">Command</Label>
                  <Input
                    id="command"
                    value={formData.command}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        command: e.target.value,
                      }))
                    }
                    placeholder="e.g., node, python, ./script.js"
                  />
                  {errors.command && (
                    <p className="text-sm text-red-500">{errors.command}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="args">Arguments (optional)</Label>
                  <Textarea
                    id="args"
                    value={formData.args}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, args: e.target.value }))
                    }
                    placeholder="Space-separated arguments"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="url">Server URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://example.com/mcp"
                />
                {errors.url && (
                  <p className="text-sm text-red-500">{errors.url}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
