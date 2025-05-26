import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClearLogsDialog } from "@/components/ClearLogsDialog";
import { LogDetailsDialog } from "@/components/LogDetailsDialog";
import { FileText, Download, Trash2, RefreshCw, Eye } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  server: string;
  message: string;
}

interface LogFile {
  name: string;
  size: number;
  modified: string;
  path: string;
}

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchLogFiles();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      } else {
        console.error("Failed to fetch logs");
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const fetchLogFiles = async () => {
    try {
      const response = await fetch("/api/log-files");
      if (response.ok) {
        const data = await response.json();
        setLogFiles(data);
      } else {
        console.error("Failed to fetch log files");
      }
    } catch (error) {
      console.error("Error fetching log files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLogs(), fetchLogFiles()]);
    setRefreshing(false);
  };

  const handleExport = () => {
    // Export logs as JSON
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `yamcp-logs-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    setShowClearDialog(true);
  };

  const confirmClearLogs = () => {
    setLogs([]);
  };

  const handleViewLogDetails = (log: LogEntry) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  const handleDownloadLogFile = (logFile: LogFile) => {
    // Extract workspace and filename from the log file name
    const [workspace, filename] = logFile.name.split("/");
    const url = `/api/log-files/${workspace}/${filename}`;

    // Create a temporary link to download the file
    const link = document.createElement("a");
    link.href = url;
    link.download = logFile.name.replace("/", "_");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warn":
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-100 text-blue-800">Info</Badge>;
      case "debug":
        return <Badge variant="outline">Debug</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
            <p className="text-muted-foreground">
              View server logs and system events
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" disabled>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" disabled>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>Loading logs...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 rounded animate-pulse"
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">
            View server logs and system events
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleClearLogs}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>
            Recent server events and error messages ({logs.length} entries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-4 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {getLevelBadge(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{log.server}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {log.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewLogDetails(log)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  No logs
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No log entries found. Try running some workspaces to generate
                  logs.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Files</CardTitle>
          <CardDescription>
            Access and download log files ({logFiles.length} files)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logFiles.length > 0 ? (
            <div className="space-y-2">
              {logFiles.map((logFile) => (
                <div
                  key={`${logFile.name}-${logFile.modified}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{logFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(logFile.size)} • Modified{" "}
                        {formatDate(logFile.modified)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadLogFile(logFile)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No log files
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                No log files found. Log files are created when workspaces are
                run.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ClearLogsDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        onConfirm={confirmClearLogs}
        logCount={logs.length}
      />

      <LogDetailsDialog
        open={showLogDetails}
        onOpenChange={setShowLogDetails}
        log={selectedLog}
      />
    </div>
  );
}
