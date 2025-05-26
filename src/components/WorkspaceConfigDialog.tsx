import { useState } from "react";
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
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);

  const generateMCPConfig = () => {
    if (!workspace) return {};

    return {
      mcpServers: {
        [workspace.name]: {
          command: "yamcp",
          args: ["run", workspace.name],
        },
      },
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
          {/* MCP Configuration - First Section */}
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
              This configuration runs the entire "{workspace?.name}" workspace
              through yamcp, giving your AI app access to all{" "}
              {workspace?.servers.length || 0} servers in the workspace.
            </p>
          </div>

          {/* Workspace Details */}
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
              <div className="flex justify-between">
                <span className="text-sm font-medium">Description:</span>
                <span className="text-sm text-muted-foreground">
                  {workspace?.description || "No description"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Included Servers:</span>
              <div className="flex flex-wrap gap-1">
                {workspace?.servers?.map((serverName) => (
                  <Badge key={serverName} variant="outline" className="text-xs">
                    {serverName}
                  </Badge>
                )) || (
                  <span className="text-sm text-muted-foreground">
                    No servers
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Setup Instructions</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  For Cursor:
                </div>
                <div className="text-blue-800 dark:text-blue-200 space-y-1">
                  <div>1. Copy the configuration above</div>
                  <div>
                    2. Save it to{" "}
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                      ~/.cursor/mcp.json
                    </code>
                  </div>
                  <div>3. Restart Cursor to load the configuration</div>
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-md">
                <div className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                  For Claude Desktop:
                </div>
                <div className="text-purple-800 dark:text-purple-200 space-y-1">
                  <div>1. Copy the mcpServers section above</div>
                  <div>2. Add it to your Claude Desktop configuration file</div>
                  <div>3. Restart Claude Desktop to apply changes</div>
                </div>
              </div>

              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                <div className="font-medium text-green-900 dark:text-green-100 mb-2">
                  How it works:
                </div>
                <div className="text-green-800 dark:text-green-200 space-y-1">
                  <div>
                    • YAMCP acts as a gateway to all servers in this workspace
                  </div>
                  <div>
                    • Your AI app connects to yamcp instead of individual
                    servers
                  </div>
                  <div>
                    • All {workspace?.servers.length || 0} servers are
                    accessible through one connection
                  </div>
                  <div>• Logs are centralized for easier debugging</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
