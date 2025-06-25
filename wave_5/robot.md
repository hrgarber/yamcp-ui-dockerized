# 🤖 AI Guide: Understanding Wave 5

If you're an AI assistant being asked to work on this project, start here.

## Project Context

You're looking at Wave 5 of a project that's trying to fix a broken UI. The original YAMCP-UI was built for a Node.js backend (YAMCP) that no longer works. Instead of fixing YAMCP, we're replacing it with a Python backend using FastMCP.

## The Core Problem We're Solving

```
Broken: React UI → server.mjs → YAMCP (Node.js) ❌
Fixed:  React UI → FastAPI → FastMCP (Python) ✅
```

## Wave 5 File Guide

### Start Here (In Order)

1. **README.md** - The big picture
   - What we're building and why
   - Quick start instructions
   - Shows it's a dev environment, not production

2. **backend-architecture.md** - How the pieces fit
   - Component diagram
   - Data flow
   - Each component's responsibilities
   - Read this to understand the design

3. **quick-start.md** - The actual implementation
   - Complete working code (~100 lines)
   - Shows both CLI and HTTP interfaces
   - This is what actually runs

### Reference Documents

4. **backend-dev-spec.md** - Original specification
   - Detailed requirements
   - CLI examples
   - Success criteria

5. **ui-integration-guide.md** - Connecting the UI
   - How to make the existing React UI work with our backend
   - Troubleshooting tips
   - API compatibility table

6. **architecture-diagram.md** - Visual representations
   - Multiple views of the system
   - Helps visualize the flow

## Key Concepts to Understand

### 1. It's a Dev Server
- Not meant for production
- Intentionally simple (~100 lines)
- No persistence (resets on restart)
- No Docker/Nginx complexity

### 2. Two Interfaces
- **CLI**: `python dev_server.py create workspace-name`
- **HTTP API**: `POST /api/workspaces/{name}`
- Both manipulate the same in-memory workspace dictionary

### 3. FastMCP Does the Magic
- Each workspace is a FastMCP instance
- FastMCP aggregates multiple MCP servers
- We mount workspaces at `/workspace/{name}/`
- Everything runs in a single Python process

### 4. The UI Doesn't Change
- The React UI thinks it's still talking to YAMCP
- We implement the same API endpoints YAMCP had
- Just point the UI to port 8000 instead of 8765

## Common Tasks

### "Implement the backend"
1. Copy code from `quick-start.md`
2. Install: `pip install fastapi fastmcp uvicorn typer`
3. Run: `python dev_server.py serve`

### "Make it work with real MCP servers"
Look for the TODO in the code:
```python
# TODO: Mount real MCP servers here
# For now, create workspace-specific tools
```
This is where you'd spawn actual MCP server processes and mount them.

### "Add a new endpoint"
1. Add to the FastAPI app (HTTP interface)
2. Optionally add a CLI command too
3. Keep the same pattern: thin handlers that call shared logic

### "Fix the UI integration"
1. The UI expects endpoints listed in `ui-integration-guide.md`
2. We only implement the essential ones
3. Return the exact JSON format the UI expects

## Design Philosophy

1. **Maximum Simplicity**: This is dev-only, so keep it simple
2. **Pure Python**: No mixing languages unless absolutely necessary
3. **In-Process**: Everything runs in one Python process (no Docker)
4. **Clear Boundaries**: CLI, HTTP API, and FastMCP are clearly separated

## What Success Looks Like

```bash
# Terminal 1
$ python dev_server.py serve
⚠️  DEV SERVER - Max 5 workspaces, resets on restart
🌐 API: http://0.0.0.0:8000

# Terminal 2
$ python dev_server.py create my-workspace config.json
Workspace 'my-workspace' created

# Browser
Open http://localhost:5173 (React UI)
Create a workspace through the UI
It should show as "running" ✅
```

## Don't Get Confused By

1. **Earlier Waves**: Waves 1-4 had different approaches (Docker, etc.). Wave 5 is simpler.
2. **Production Features**: This isn't production code. No auth, monitoring, or persistence.
3. **YAMCP References**: YAMCP is dead. We're replacing it, not fixing it.

## Your Mission

Make the React UI work with a Python FastMCP backend. The code is mostly written in `quick-start.md`. Your job is to understand it, potentially enhance it, and ensure the UI can create and manage workspaces through our new backend.

Remember: Keep it simple. This is a development tool, not a production system.