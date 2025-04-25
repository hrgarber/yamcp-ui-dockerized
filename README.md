# MCPX - A Model Context Workspace Manager

MCPX is a command-line tool for organizing and managing MCP Servers as local workspaces. It enables seamless connection to multiple MCP servers (both local and remote) and bundles them into workspaces for use in AI Apps. All server communications are tracked in a consolidated log store for easy monitoring and debugging.

## 🚀 Quick Start

```bash
# Install MCPX
npm install -g @mcpspace/mcpx  # or use npx @mcpspace/mcpx

# Import servers (choose one)
mcpx server import [config]    # import servers from config file (https://example.com)
mcpx server add         # or add manuall

# create workspace
mcpx ws create

# Run workspace in your AI app
mcpx run <workspace-name>
```

## 🔑 Key Concepts

- **MCP Servers**: Remote or local servers that provide Model Context Protocol services
- **Workspaces**: Collections of MCP servers grouped together to be shared with AI Apps (e.g. a workspace for coding, writing, design, magic making!)
- **Gateway**: A local MCP server that manages connections to configured MCP servers in a workspace and exposes them through a unified server to AI App's MCP clients

With MCPX, you can:

- Manage multiple MCP server connections as a unified server
- Create workspaces to organize servers for different projects
- Start a gateway server to interact with your bundled MCP servers in a workspace
- Monitor server communications through consolidated logging
- Configure and modify workspace settings easily

## 🧭 Top-Level Commands

```bash
mcpx [command] [subcommand] [flags]
```

Available top-level commands:

- `server` - Manage MCP providers
- `ws` - Manage workspaces
- `run` - Run the gateway with a workspace
- `log` - View the server log location

---

## 🔧 **MCP Server Management Commands**

### ➕ Add a new MCP server (local or remote)

```bash
mcpx server add
```

Interactive flow that guides you through:

- Selecting server type (Local Command/stdio or Remote Server/SSE)
- Setting server name
- Configuring connection details (command or URL)
- Optional environment variables (for local servers)

### 📋 List all added MCP servers

```bash
mcpx server list
```

Displays all configured servers with their details and allows you to:

- View server configurations
- Scan server capabilities
- Check server status

### ❌ Remove a server

```bash
mcpx server remove [name]
```

Removes a server configuration by its name, with confirmation prompt. If no name is provided, you'll be prompted to select a server to remove.

### ⚙️ Import servers from config file

```bash
mcpx server import [config]
```

Bulk imports server configurations from a JSON file. If no config file is provided and a default configuration exists, you'll be prompted to use it.

---

## 🧪 **Workspace Commands**

### 📦 Create a new workspace

```bash
mcpx ws create
```

Interactive flow that guides you through:

- Setting workspace name
- Selecting servers to include
- Confirming workspace creation

### 📋 List workspaces

```bash
mcpx ws list [--name <workspace-name>]
```

Lists all workspaces or shows details of a specific workspace.

### ✏️ Edit a workspace

```bash
mcpx ws edit
```

Interactive flow to:

- Select a workspace to edit
- Modify included servers
- Update workspace settings

### ❌ Delete a workspace

```bash
mcpx ws delete [workspace-name]
```

Deletes a workspace configuration, with confirmation prompt.
If no workspace name is provided, you'll be prompted to select from existing workspaces.

### 🚀 Run the gateway

```bash
mcpx run <workspace-name>
```

Starts the gateway server with the specified workspace configuration.

### 📊 View Logs

```bash
mcpx log
```

Access server communication logs stored in the consolidated log store.

---

## ✅ Command Cheat Sheet

| Command          | Description                        | Example                            |
| ---------------- | ---------------------------------- | ---------------------------------- |
| `server add`     | Add a new MCP server interactively | `mcpx server add`                  |
| `server list`    | List all configured servers        | `mcpx server list`                 |
| `server remove`  | Remove a server by name            | `mcpx server remove [name]`        |
| `server import`  | Import servers from config file    | `mcpx server import [config]`      |
| `ws create`      | Create a new workspace             | `mcpx ws create`                   |
| `ws list`        | List all workspaces                | `mcpx ws list`                     |
| `ws list --name` | Show specific workspace details    | `mcpx ws list --name my-workspace` |
| `ws edit`        | Edit workspace configuration       | `mcpx ws edit`                     |
| `ws delete`      | Delete a workspace                 | `mcpx ws delete [workspace-name]`  |
| `run`            | Start gateway with workspace       | `mcpx run <workspace-name>`        |
| `log`            | View server logs                   | `mcpx log`                         |

---
