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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClearLogsDialog } from "@/components/ClearLogsDialog";
import { LogDetailsDialog } from "@/components/LogDetailsDialog";
import { FileText, Download, Trash2, RefreshCw, Eye, Filter } from "lucide-react";

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
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

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
    const normalizedLevel = level.toLowerCase();
    switch (normalizedLevel) {
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

  // Get unique workspaces from logs
  const getUniqueWorkspaces = () => {
    const workspaces = Array.from(new Set(logs.map(log => log.server)));
    return workspaces.sort();
  };

  // Filter logs based on workspace and level
  const getFilteredLogs = () => {
    let filtered = logs;
    
    if (selectedWorkspace !== "all") {
      filtered = filtered.filter(log => log.server === selectedWorkspace);
    }
    
    if (selectedLevel !== "all") {
      filtered = filtered.filter(log => {
        const logLevel = (log.level || "").toLowerCase().trim();
        const filterLevel = selectedLevel.toLowerCase().trim();
        return logLevel === filterLevel;
      });
    }
    
    return filtered;
  };

  // Group logs by workspace
  const getGroupedLogs = () => {
    const filtered = getFilteredLogs();
    const grouped: Record<string, LogEntry[]> = {};
    
    filtered.forEach(log => {
      if (!grouped[log.server]) {
        grouped[log.server] = [];
      }
      grouped[log.server].push(log);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Recent server events and error messages ({getFilteredLogs().length} entries)
              </CardDescription>
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
          
          {/* Filters */}
          <div className="flex items-center space-x-4 pt-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-muted-foreground">Workspace:</label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {getUniqueWorkspaces().map(workspace => (
                    <SelectItem key={workspace} value={workspace}>
                      {workspace}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-muted-foreground">Level:</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {logs.length > 0 ? (
              selectedWorkspace === "all" ? (
                // Show grouped by workspace when "All Workspaces" is selected
                Object.entries(getGroupedLogs()).map(([workspaceName, workspaceLogs]) => (
                  <div key={workspaceName} className="space-y-3">
                    <div className="flex items-center space-x-2 border-b pb-2">
                      <h4 className="font-semibold text-lg">{workspaceName}</h4>
                      <Badge variant="outline">{workspaceLogs.length} entries</Badge>
                    </div>
                    <div className="space-y-3 pl-4">
                      {workspaceLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-shrink-0">
                            {getLevelBadge(log.level)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(log.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mt-1">
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
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Show flat list when specific workspace is selected
                getFilteredLogs().map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg"
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
                      <p className="text-sm text-foreground mt-1">
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
              )
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
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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
