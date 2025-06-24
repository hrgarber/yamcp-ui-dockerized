import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddServerDialog } from "@/components/AddServerDialog";
import { AddWorkspaceDialog } from "@/components/AddWorkspaceDialog";
import { Server, FolderOpen, Activity, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Stats {
  totalServers: number;
  activeServers: number;
  totalWorkspaces: number;
  activeWorkspaces: number;
  issues: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  server: string;
  message: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalServers: 0,
    activeServers: 0,
    totalWorkspaces: 0,
    activeWorkspaces: 0,
    issues: 0,
  });
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddServerDialog, setShowAddServerDialog] = useState(false);
  const [showAddWorkspaceDialog, setShowAddWorkspaceDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsResponse = await fetch("/api/stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch recent logs
      const logsResponse = await fetch("/api/logs");
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setRecentLogs(logsData.slice(0, 5)); // Show only 5 most recent
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "add-server":
        setShowAddServerDialog(true);
        break;
      case "create-workspace":
        setShowAddWorkspaceDialog(true);
        break;
      case "view-logs":
        navigate("/logs");
        break;
    }
  };

  const handleServerAdded = () => {
    // Refresh dashboard data after adding a server
    fetchDashboardData();
  };

  const handleWorkspaceAdded = () => {
    // Refresh dashboard data after adding a workspace
    fetchDashboardData();
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500";
      case "warn":
        return "bg-yellow-500";
      case "info":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Servers
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalServers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeServers} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Servers
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeServers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalServers > 0
                  ? Math.round((stats.activeServers / stats.totalServers) * 100)
                  : 0}
                % uptime
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkspaces}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeWorkspaces} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.issues}</div>
              <p className="text-xs text-muted-foreground">
                {stats.issues === 0
                  ? "All systems operational"
                  : "Needs attention"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest server and workspace events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentLogs.length > 0 ? (
                  recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center space-x-4">
                      <div
                        className={`w-2 h-2 rounded-full ${getActivityColor(
                          log.level
                        )}`}
                      ></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.server} •{" "}
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  onClick={() => handleQuickAction("add-server")}
                  className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="font-medium">Add New Server</div>
                  <div className="text-sm text-muted-foreground">
                    Configure a new MCP server
                  </div>
                </button>
                <button
                  onClick={() => handleQuickAction("create-workspace")}
                  className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="font-medium">Create Workspace</div>
                  <div className="text-sm text-muted-foreground">
                    Group servers into a workspace
                  </div>
                </button>
                <button
                  onClick={() => handleQuickAction("view-logs")}
                  className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="font-medium">View Logs</div>
                  <div className="text-sm text-muted-foreground">
                    Check server communication logs
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Dialogs */}
      <AddServerDialog
        open={showAddServerDialog}
        onOpenChange={setShowAddServerDialog}
        onServerAdded={handleServerAdded}
      />

      <AddWorkspaceDialog
        open={showAddWorkspaceDialog}
        onOpenChange={setShowAddWorkspaceDialog}
        onWorkspaceAdded={handleWorkspaceAdded}
      />
    </>
  );
}
