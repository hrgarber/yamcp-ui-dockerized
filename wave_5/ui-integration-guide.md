# UI Integration Guide: Dev Server Edition

## The Simplest Possible Integration

Since this is a dev-only MVP, we're going with the absolute simplest approach:

1. **Backend**: Pure Python FastAPI server on port 8000
2. **UI**: Existing React app on port 5173 (or 3000)
3. **Integration**: Just update the API URL

## Step 1: Start the Dev Server

```bash
cd wave_5
python dev_server.py serve
```

You'll see:
```
⚠️  DEV SERVER - Max 5 workspaces, resets on restart
📅 Expires: [30 days from now]
🌐 API: http://0.0.0.0:8000
📝 Docs: http://0.0.0.0:8000/docs
```

## Step 2: Update UI Configuration

The UI needs to know where the backend is. You have a few options:

### Option A: Environment Variable (Recommended)
Create `.env` in the UI root:
```env
REACT_APP_API_URL=http://localhost:8000
```

### Option B: Update vite.config.js
If using Vite, add proxy configuration:
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
}
```

### Option C: Hardcode for Dev (Quickest)
Just search/replace in the UI code:
- Replace: `http://localhost:8765` 
- With: `http://localhost:8000`

## Step 3: Run the UI

```bash
# From project root
npm install
npm run dev
```

## Step 4: Test It

1. Open http://localhost:5173
2. Create a workspace in the UI
3. Check the dev server terminal - you should see the requests
4. The workspace should appear as "running"

## What the Integration Looks Like

```
Browser → React UI (:5173) → FastAPI Dev Server (:8000)
                                      ↓
                              In-Process FastMCP
                              (No Docker, No Nginx)
```

## API Compatibility

The dev server implements these endpoints that the UI expects:

| Endpoint | Purpose | Status |
|----------|---------|---------|
| `POST /api/workspaces/{name}` | Create/update workspace | ✅ Working |
| `GET /api/workspaces` | List all workspaces | ✅ Working |
| `DELETE /api/workspaces/{name}` | Delete workspace | ✅ Working |
| `GET /api/stats` | Dashboard statistics | ✅ Basic implementation |
| `GET /api/servers` | List MCP servers | ❌ Not needed for MVP |
| `GET /api/logs` | View logs | ❌ Not needed for MVP |

## Troubleshooting

### CORS Issues
The dev server already includes CORS middleware for localhost:3000 and localhost:5173. If you're using a different port:

```python
# In dev_server.py, update:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    ...
)
```

### Connection Refused
Make sure the dev server is running before starting the UI.

### Workspace Not Working
The dev server creates real FastMCP workspaces but MCP server process spawning is still being implemented.

## CLI Testing

You can also test without the UI:

```bash
# Create workspace via CLI
curl -X POST http://localhost:8000/api/workspaces/dev \
  -H "Content-Type: application/json" \
  -d '{"name": "dev", "servers": {"filesystem": {"command": "mcp-server-filesystem", "args": ["/tmp"]}}}'

# Should return:
{
  "success": true,
  "workspace": {
    "name": "dev",
    "status": "running",
    "url": "http://localhost:8000/workspace/dev/mcp/v1"
  }
}
```

## What's Not Implemented (It's Just Dev!)

- Real MCP server mounting (just demo tools)
- Authentication (it's local only)
- Persistence (resets on restart)
- Error handling (minimal)
- WebSocket/SSE (if the UI needs it)

## Next Steps

Once you verify the UI can talk to the backend:
1. Add real FastMCP server mounting
2. Test with actual MCP clients
3. Document what a production system needs
4. Build that properly (with Docker, auth, etc.)

**Remember**: This is temporary! Set a calendar reminder to revisit in 30 days.