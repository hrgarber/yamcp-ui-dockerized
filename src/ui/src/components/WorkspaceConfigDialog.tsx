import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";

interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  servers: string[];
  status: string;
  lastUsed: string;
}

interface ServerData {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
}

interface WorkspaceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceData | null;
}

export function WorkspaceConfigDialog({
  open,
  onOpenChange,
  workspace,
}: WorkspaceConfigDialogProps) {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

  useEffect(() => {
    if (open && workspace) {
      fetchServers();
    }
  }, [open, workspace]);

  const fetchServers = async () => {
    try {
      const response = await fetch("/api/servers");
      if (response.ok) {
        const allServers = await response.json();
        setServers(allServers);
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
    }
  };

  const generateMCPConfig = () => {
    if (!workspace || !servers.length) return {};

    const mcpServers: Record<string, any> = {};

    workspace.servers.forEach((serverName) => {
      const server = servers.find((s) => s.id === serverName);
      if (server && server.type === "stdio") {
        mcpServers[server.name] = {
          command: server.command,
          args: server.args || [],
        };
      }
    });

    return {
      mcpServers,
    };
  };

  const copyToClipboard = async (config: object, configType: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopiedConfig(configType);
      setTimeout(() => setCopiedConfig(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const mcpConfig = generateMCPConfig();
  const workspaceServers = workspace?.servers
    .map((serverName) => servers.find((s) => s.id === serverName))
    .filter(Boolean) as ServerData[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workspace Configuration</DialogTitle>
          <DialogDescription>
            MCP configuration for "{workspace?.name}" workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Workspace Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Workspace Details</h3>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Name:</span>
                <span className="text-sm text-muted-foreground">
                  {workspace?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Servers:</span>
                <span className="text-sm text-muted-foreground">
                  {workspace?.servers.length || 0}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {workspace?.servers.map((serverName) => (
                <Badge key={serverName} variant="outline" className="text-xs">
                  {serverName}
                </Badge>
              ))}
            </div>
          </div>

          {/* Server Details */}
          {workspaceServers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Server Configurations</h3>
              <div className="space-y-2">
                {workspaceServers.map((server) => (
                  <div
                    key={server.id}
                    className="p-3 border rounded-md bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{server.name}</span>
                      <Badge variant="outline">{server.type}</Badge>
                    </div>
                    {server.type === "stdio" && (
                      <div className="text-sm text-muted-foreground">
                        <div>Command: {server.command}</div>
                        {server.args && server.args.length > 0 && (
                          <div>Args: {server.args.join(" ")}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MCP Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">MCP Configuration</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(mcpConfig, "mcp")}
                disabled={Object.keys(mcpConfig.mcpServers || {}).length === 0}
              >
                {copiedConfig === "mcp" ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copiedConfig === "mcp" ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(mcpConfig, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this configuration to your Cursor settings (mcp.json) or
              Claude Desktop configuration file.
            </p>
          </div>

          {/* Usage Instructions */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Usage Instructions</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                <strong>For Cursor:</strong> Save the configuration to{" "}
                <code className="bg-muted px-1 rounded">
                  ~/.cursor/mcp.json
                </code>
              </div>
              <div>
                <strong>For Claude Desktop:</strong> Add the mcpServers section
                to your Claude Desktop configuration file
              </div>
              <div>
                <strong>Note:</strong> Only stdio servers are included in the
                configuration. SSE servers require different setup.
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
