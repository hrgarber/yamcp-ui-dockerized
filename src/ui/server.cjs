const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Import YAMCP modules - we need to use the compiled JS files from dist
const yamcpPath = path.join(__dirname, "..", "..", "dist");

// Helper function to safely require YAMCP modules
function requireYAMCP(modulePath) {
  try {
    return require(path.join(yamcpPath, modulePath));
  } catch (error) {
    console.error(`Failed to load YAMCP module ${modulePath}:`, error.message);
    return null;
  }
}

// Load YAMCP modules
const config = requireYAMCP("config.js");
const { loadProvidersMap, loadWorkspaceMap } =
  requireYAMCP("store/loader.js") || {};
const { addMcpProviders, removeMcpProvider, getMcpProviders } =
  requireYAMCP("store/provider.js") || {};
const { addWorkspace, removeWorkspace, getWorkspaces } =
  requireYAMCP("store/workspace.js") || {};

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "dist")));

// Parse JSON bodies
app.use(express.json());

// Helper function to get config paths
function getConfigPaths() {
  if (!config) {
    // Fallback to manual path construction if config module fails
    const envPaths = require("env-paths");
    const paths = envPaths("yamcp");
    return {
      providersPath: path.join(paths.data, "providers.json"),
      workspacesPath: path.join(paths.data, "workspaces.json"),
      logDir: paths.log,
    };
  }
  return {
    providersPath: config.PROVIDERS_CONFIG_PATH,
    workspacesPath: config.WORKSPACES_CONFIG_PATH,
    logDir: config.LOG_DIR,
  };
}

// Helper function to safely load JSON file
function loadJSONFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
  }
  return defaultValue;
}

// Helper function to get real providers data
function getRealProviders() {
  try {
    if (getMcpProviders) {
      return getMcpProviders();
    }
    // Fallback to direct file loading
    const { providersPath } = getConfigPaths();
    return loadJSONFile(providersPath, {});
  } catch (error) {
    console.error("Error getting providers:", error.message);
    return {};
  }
}

// Helper function to get real workspaces data
function getRealWorkspaces() {
  try {
    if (getWorkspaces) {
      return getWorkspaces();
    }
    // Fallback to direct file loading
    const { workspacesPath } = getConfigPaths();
    return loadJSONFile(workspacesPath, {});
  } catch (error) {
    console.error("Error getting workspaces:", error.message);
    return {};
  }
}

// Helper function to read log files
function getRecentLogs(limit = 50) {
  try {
    const { logDir } = getConfigPaths();
    const logs = [];

    if (!fs.existsSync(logDir)) {
      return [];
    }

    // Get all workspace directories
    const workspaceDirs = fs.readdirSync(logDir).filter((dir) => {
      const dirPath = path.join(logDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });

    // Read logs from each workspace
    for (const workspaceDir of workspaceDirs) {
      const combinedLogPath = path.join(logDir, workspaceDir, "combined.log");

      if (fs.existsSync(combinedLogPath)) {
        try {
          const logContent = fs.readFileSync(combinedLogPath, "utf-8");
          const logLines = logContent
            .trim()
            .split("\n")
            .filter((line) => line.trim());

          // Parse each log line (Winston JSON format)
          for (const line of logLines.slice(-20)) {
            // Get last 20 from each file
            try {
              const logEntry = JSON.parse(line);
              logs.push({
                id: `${workspaceDir}_${logEntry.timestamp}`,
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                server: workspaceDir.split("_")[0], // Extract workspace name
                message: logEntry.message || JSON.stringify(logEntry),
              });
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        } catch (fileError) {
          console.error(
            `Error reading log file ${combinedLogPath}:`,
            fileError.message
          );
        }
      }
    }

    // Sort by timestamp and limit
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  } catch (error) {
    console.error("Error getting logs:", error.message);
    return [];
  }
}

// API Routes
app.get("/api/stats", (req, res) => {
  try {
    const providers = getRealProviders();
    const workspaces = getRealWorkspaces();

    const totalServers = Object.keys(providers).length;
    const totalWorkspaces = Object.keys(workspaces).length;

    // For now, assume all servers are active (we'd need to track actual status)
    const activeServers = totalServers;
    const activeWorkspaces = totalWorkspaces;

    res.json({
      totalServers,
      activeServers,
      totalWorkspaces,
      activeWorkspaces,
      issues: 0, // Could be calculated based on failed scans or connection issues
    });
  } catch (error) {
    console.error("Error getting stats:", error.message);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

app.get("/api/servers", (req, res) => {
  try {
    const providers = getRealProviders();

    const servers = Object.values(providers).map((provider, index) => {
      const isStdio = provider.type === "stdio";

      return {
        id: provider.namespace,
        name: provider.namespace,
        type: provider.type,
        status: "stopped", // Default status - would need actual tracking
        ...(isStdio
          ? {
              command: provider.providerParameters.command,
              args: provider.providerParameters.args || [],
            }
          : {
              url: provider.providerParameters.url,
            }),
        lastSeen: "Unknown", // Would need actual tracking
      };
    });

    res.json(servers);
  } catch (error) {
    console.error("Error getting servers:", error.message);
    res.status(500).json({ error: "Failed to get servers" });
  }
});

app.get("/api/workspaces", (req, res) => {
  try {
    const workspaces = getRealWorkspaces();
    const providers = getRealProviders();

    const workspaceList = Object.entries(workspaces).map(
      ([name, serverNames]) => {
        // Validate that all servers in workspace exist
        const validServers = serverNames.filter(
          (serverName) => providers[serverName]
        );

        return {
          id: name,
          name: name,
          description: `Workspace with ${validServers.length} server${
            validServers.length === 1 ? "" : "s"
          }`,
          servers: validServers,
          status: "inactive", // Default status - would need actual tracking
          lastUsed: "Unknown", // Would need actual tracking
        };
      }
    );

    res.json(workspaceList);
  } catch (error) {
    console.error("Error getting workspaces:", error.message);
    res.status(500).json({ error: "Failed to get workspaces" });
  }
});

app.get("/api/logs", (req, res) => {
  try {
    const logs = getRecentLogs(100);
    res.json(logs);
  } catch (error) {
    console.error("Error getting logs:", error.message);
    res.status(500).json({ error: "Failed to get logs" });
  }
});

// Server actions
app.post("/api/servers/:id/start", (req, res) => {
  const { id } = req.params;
  // TODO: Implement actual server starting logic
  // This would involve spawning the server process and tracking its status
  res.json({
    success: true,
    message: `Server ${id} start requested (not implemented yet)`,
  });
});

app.post("/api/servers/:id/stop", (req, res) => {
  const { id } = req.params;
  // TODO: Implement actual server stopping logic
  // This would involve killing the server process
  res.json({
    success: true,
    message: `Server ${id} stop requested (not implemented yet)`,
  });
});

app.delete("/api/servers/:id", (req, res) => {
  const { id } = req.params;
  try {
    if (removeMcpProvider) {
      removeMcpProvider(id);
      res.json({ success: true, message: `Server ${id} deleted successfully` });
    } else {
      // Fallback to direct file manipulation
      const { providersPath } = getConfigPaths();
      const providers = loadJSONFile(providersPath, {});
      delete providers[id];
      fs.writeFileSync(providersPath, JSON.stringify(providers, null, 2));
      res.json({ success: true, message: `Server ${id} deleted successfully` });
    }
  } catch (error) {
    console.error(`Error deleting server ${id}:`, error.message);
    res.status(500).json({ error: `Failed to delete server ${id}` });
  }
});

// Add new server
app.post("/api/servers", (req, res) => {
  const { name, type, command, args, env, url } = req.body;

  try {
    const newProvider = {
      namespace: name,
      type: type,
      providerParameters:
        type === "stdio"
          ? {
              command,
              args: args || [],
              env: env || {},
            }
          : {
              url,
            },
    };

    if (addMcpProviders) {
      addMcpProviders([newProvider]);
    } else {
      // Fallback to direct file manipulation
      const { providersPath } = getConfigPaths();
      const providers = loadJSONFile(providersPath, {});
      providers[name] = newProvider;
      fs.writeFileSync(providersPath, JSON.stringify(providers, null, 2));
    }

    res.json({ success: true, message: `Server ${name} added successfully` });
  } catch (error) {
    console.error(`Error adding server ${name}:`, error.message);
    res.status(500).json({ error: `Failed to add server ${name}` });
  }
});

// Update server
app.put("/api/servers/:id", (req, res) => {
  const { id } = req.params;
  const { name, type, command, args, env, url } = req.body;

  try {
    const { providersPath } = getConfigPaths();
    const providers = loadJSONFile(providersPath, {});

    // Check if server exists
    if (!providers[id]) {
      return res.status(404).json({ error: `Server ${id} not found` });
    }

    // If name changed, we need to handle the namespace change
    if (name !== id) {
      // Remove old entry
      delete providers[id];
    }

    // Create updated provider
    const updatedProvider = {
      namespace: name,
      type: type,
      providerParameters:
        type === "stdio"
          ? {
              command,
              args: args || [],
              env: env || {},
            }
          : {
              url,
            },
    };

    // Add updated provider
    providers[name] = updatedProvider;

    // If name changed, update workspaces that reference this server
    if (name !== id) {
      const { workspacesPath } = getConfigPaths();
      const workspaces = loadJSONFile(workspacesPath, {});

      for (const [workspaceName, serverList] of Object.entries(workspaces)) {
        const serverIndex = serverList.indexOf(id);
        if (serverIndex !== -1) {
          serverList[serverIndex] = name;
        }
      }

      fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
    }

    // Save providers
    fs.writeFileSync(providersPath, JSON.stringify(providers, null, 2));

    res.json({
      success: true,
      message: `Server ${name} updated successfully`,
    });
  } catch (error) {
    console.error(`Error updating server ${id}:`, error.message);
    res.status(500).json({ error: `Failed to update server ${id}` });
  }
});

// Workspace actions
app.post("/api/workspaces/:id/start", (req, res) => {
  const { id } = req.params;
  // TODO: Implement actual workspace starting logic
  // This would involve starting all servers in the workspace
  res.json({
    success: true,
    message: `Workspace ${id} start requested (not implemented yet)`,
  });
});

app.post("/api/workspaces/:id/stop", (req, res) => {
  const { id } = req.params;
  // TODO: Implement actual workspace stopping logic
  // This would involve stopping all servers in the workspace
  res.json({
    success: true,
    message: `Workspace ${id} stop requested (not implemented yet)`,
  });
});

app.delete("/api/workspaces/:id", (req, res) => {
  const { id } = req.params;
  try {
    if (removeWorkspace) {
      removeWorkspace(id);
      res.json({
        success: true,
        message: `Workspace ${id} deleted successfully`,
      });
    } else {
      // Fallback to direct file manipulation
      const { workspacesPath } = getConfigPaths();
      const workspaces = loadJSONFile(workspacesPath, {});
      delete workspaces[id];
      fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
      res.json({
        success: true,
        message: `Workspace ${id} deleted successfully`,
      });
    }
  } catch (error) {
    console.error(`Error deleting workspace ${id}:`, error.message);
    res.status(500).json({ error: `Failed to delete workspace ${id}` });
  }
});

// Add new workspace
app.post("/api/workspaces", (req, res) => {
  const { name, servers } = req.body;

  try {
    if (addWorkspace) {
      addWorkspace(name, servers);
    } else {
      // Fallback to direct file manipulation
      const { workspacesPath } = getConfigPaths();
      const workspaces = loadJSONFile(workspacesPath, {});
      workspaces[name] = servers;
      fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
    }

    res.json({
      success: true,
      message: `Workspace ${name} created successfully`,
    });
  } catch (error) {
    console.error(`Error creating workspace ${name}:`, error.message);
    res.status(500).json({ error: `Failed to create workspace ${name}` });
  }
});

// Update workspace
app.put("/api/workspaces/:id", (req, res) => {
  const { id } = req.params;
  const { servers } = req.body;

  try {
    if (addWorkspace) {
      addWorkspace(id, servers); // addWorkspace also updates existing workspaces
    } else {
      // Fallback to direct file manipulation
      const { workspacesPath } = getConfigPaths();
      const workspaces = loadJSONFile(workspacesPath, {});
      workspaces[id] = servers;
      fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
    }

    res.json({
      success: true,
      message: `Workspace ${id} updated successfully`,
    });
  } catch (error) {
    console.error(`Error updating workspace ${id}:`, error.message);
    res.status(500).json({ error: `Failed to update workspace ${id}` });
  }
});

// Get log files list
app.get("/api/log-files", (req, res) => {
  try {
    const { logDir } = getConfigPaths();
    const logFiles = [];

    if (!fs.existsSync(logDir)) {
      return res.json([]);
    }

    // Get all workspace directories
    const workspaceDirs = fs.readdirSync(logDir).filter((dir) => {
      const dirPath = path.join(logDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });

    // Get log files from each workspace
    for (const workspaceDir of workspaceDirs) {
      const workspacePath = path.join(logDir, workspaceDir);
      const files = fs
        .readdirSync(workspacePath)
        .filter((file) => file.endsWith(".log"));

      for (const file of files) {
        const filePath = path.join(workspacePath, file);
        const stats = fs.statSync(filePath);

        logFiles.push({
          name: `${workspaceDir}/${file}`,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: filePath,
        });
      }
    }

    res.json(logFiles);
  } catch (error) {
    console.error("Error getting log files:", error.message);
    res.status(500).json({ error: "Failed to get log files" });
  }
});

// Download log file
app.get("/api/log-files/:workspace/:filename", (req, res) => {
  const { workspace, filename } = req.params;

  try {
    const { logDir } = getConfigPaths();
    const filePath = path.join(logDir, workspace, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Log file not found" });
    }

    res.download(filePath);
  } catch (error) {
    console.error("Error downloading log file:", error.message);
    res.status(500).json({ error: "Failed to download log file" });
  }
});

// Catch all handler: send back React's index.html file for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
