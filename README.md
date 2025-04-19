# MCPX - A Model Context Workspace Manager

MCPX is a command-line tool for organizing and managing MCP Servers as local workspaces. It enables seamless connection to multiple MCP servers (both local and remote) and bundles them into workspaces for use in AI Apps. All server communications are tracked in a consolidated log store for easy monitoring and debugging.

## 🔑 Key Concepts

- **MCP Servers**: Remote or local servers that provide Model Context Protocol services
- **Workspaces**: Collections of MCP servers grouped together to be shared with AI Apps
- **Gateway**: A local MCP server that manages connections to configured MCP servers in a workspace and exposes them through a unified server to AI App's MCP clients

With MCPX, you can:

- Manage multiple MCP server connections
- Create workspaces to organize servers for different projects
- Start a gateway server to interact with your bundled MCP servers in a workspace.
- Configure and modify workspace settings easily

## 🧭 Top-Level Command

```
mcpx [command] [subcommand] [flags]
```

---

## 🔧 **MCP Server Management Commands**

### ➕ Add a new MCP server (local or remote)

```bash
mcpx server add
```

- Interactive flow
  // Add terminal gif

### 📋 List all added MCP servers

```bash
mcpx server list
```

### ❌ Remove a server

```bash
mcpx server remove <name>
```

### ⚙️ Import servers from config file

```bash
mcpx server import  your-config.json
```

---

## 🧪 **Workspace Commands**

### 📦 Create a new workspace from selected MCPs (interactive or inline)

```bash
mcpx ws create
```

- Interactive flow:

### 📋 List all workspaces

```bash
mcpx ws list
```

### ✏️ Edit a workspace

```bash
mcpx ws edit
```

- Interactive flow to modify workspace settings and MCPs

### ❌ Delete a workspace

```bash
mcpx ws delete <workspace-name>
```

### 🚀 Run the gateway server with a given workspace

```bash
mcpx run <workspace-name>
```

---

## ✅ Summary Cheat Sheet

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `server add`       | Register a new local or remote MCP server           |
| `server list`      | Show all known MCP servers                          |
| `server remove`    | Unregister an MCP server                            |
| `server import`    | Bulk-import servers via config                      |
| `ws create`        | Create a named workspace interactively or via flags |
| `ws list`          | Show all defined workspaces                         |
| `ws delete`        | Delete a workspace                                  |
| `ws remove-server` | Remove an MCP server from a workspace               |
| `ws edit`          | Modify workspace settings and MCPs interactively    |
| `run`              | Start the gateway server for a selected workspace   |

---
