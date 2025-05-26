import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerAdded: () => void;
}

interface ServerFormData {
  name: string;
  type: "stdio" | "sse";
  command: string;
  args: string;
  env: string;
  url: string;
}

export function AddServerDialog({
  open,
  onOpenChange,
  onServerAdded,
}: AddServerDialogProps) {
  const [formData, setFormData] = useState<ServerFormData>({
    name: "",
    type: "stdio",
    command: "",
    args: "",
    env: "",
    url: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<ServerFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ServerFormData> = {};

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
      } else if (!isValidUrl(formData.url)) {
        newErrors.url = "Please enter a valid URL";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const parseArgs = (argsString: string): string[] => {
    if (!argsString.trim()) return [];
    return argsString
      .split(/\s+/)
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0);
  };

  const parseEnv = (envString: string): Record<string, string> => {
    if (!envString.trim()) return {};

    const env: Record<string, string> = {};
    const lines = envString.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes("=")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=");
        if (key.trim()) {
          env[key.trim()] = value.trim();
        }
      }
    }

    return env;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        ...(formData.type === "stdio"
          ? {
              command: formData.command.trim(),
              args: parseArgs(formData.args),
              env: parseEnv(formData.env),
            }
          : {
              url: formData.url.trim(),
            }),
      };

      const response = await fetch("/api/servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);

        // Reset form
        setFormData({
          name: "",
          type: "stdio",
          command: "",
          args: "",
          env: "",
          url: "",
        });
        setErrors({});

        // Close dialog and refresh parent
        onOpenChange(false);
        onServerAdded();
      } else {
        const error = await response.json();
        console.error("Failed to add server:", error.error);
        alert(`Failed to add server: ${error.error}`);
      }
    } catch (error) {
      console.error("Error adding server:", error);
      alert(`Error adding server: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      type: "stdio",
      command: "",
      args: "",
      env: "",
      url: "",
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Server</DialogTitle>
          <DialogDescription>
            Configure a new MCP server. Choose between stdio (command-line) or
            SSE (server-sent events) type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., github-mcp"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Server Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "stdio" | "sse") =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select server type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">stdio (Command-line)</SelectItem>
                  <SelectItem value="sse">sse (Server-sent Events)</SelectItem>
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
                      setFormData({ ...formData, command: e.target.value })
                    }
                    placeholder="e.g., npx, docker, python"
                    className={errors.command ? "border-red-500" : ""}
                  />
                  {errors.command && (
                    <p className="text-sm text-red-500">{errors.command}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="args">Arguments (space-separated)</Label>
                  <Input
                    id="args"
                    value={formData.args}
                    onChange={(e) =>
                      setFormData({ ...formData, args: e.target.value })
                    }
                    placeholder="e.g., @modelcontextprotocol/server-github"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter command arguments separated by spaces
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="env">Environment Variables (optional)</Label>
                  <Textarea
                    id="env"
                    value={formData.env}
                    onChange={(e) =>
                      setFormData({ ...formData, env: e.target.value })
                    }
                    placeholder="KEY1=value1&#10;KEY2=value2"
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter environment variables in KEY=value format, one per
                    line
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="url">Server URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/mcp"
                  className={errors.url ? "border-red-500" : ""}
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
              {loading ? "Adding..." : "Add Server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
