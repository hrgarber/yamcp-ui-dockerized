---

## 🧭 Top-Level Command

```
mcp-gateway [command] [subcommand] [flags]
```

---

## 🔧 **Server Management Commands**

### ➕ Add a new MCP server (local or remote)

```bash
mcp-gateway server add <name> <command|url> [--type local|remote]
```

- Example (local): `mcp-gateway server add local-mcp "./start-local.sh" --type local`
- Example (remote): `mcp-gateway server add prod-mcp https://prod.mcp.com --type remote`

### 📋 List all added MCP servers

```bash
mcp-gateway server list
```

### ❌ Remove a server

```bash
mcp-gateway server remove <name>
```

---

## 🧪 **Workspace Commands**

### 📦 Create a new workspace from selected MCPs (interactive or inline)

```bash
mcp-gateway workspace create <workspace-name>
```

- Interactive flow:
  ```
  mcp-gateway workspace create cursor
  👉 Select MCPs to include [✓] local-mcp [ ] prod-mcp ...
  ```

### 🚀 Run the gateway with a given workspace

```bash
mcp-gateway run <workspace-name>
```

### 📂 List all available workspaces

```bash
mcp-gateway workspace list
```

### 🧹 Delete a workspace

```bash
mcp-gateway workspace delete <workspace-name>
```

### 🧽 Remove a server from a workspace

```bash
mcp-gateway workspace remove-server <workspace-name> <server-name>
```

---

## 🧰 Optional Utility

### ⚙️ Import from config file

```bash
mcp-gateway import --config ./mcp-config.yaml
```

---

## ✅ Summary Cheat Sheet

| Command                   | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `server add`              | Register a new local or remote MCP server           |
| `server list`             | Show all known MCP servers                          |
| `server remove`           | Unregister an MCP server                            |
| `workspace create`        | Create a named workspace interactively or via flags |
| `workspace list`          | Show all defined workspaces                         |
| `workspace delete`        | Delete a workspace                                  |
| `workspace remove-server` | Remove an MCP server from a workspace               |
| `run`                     | Start the gateway for a selected workspace          |
| `import`                  | Bulk-import servers via config                      |

---
