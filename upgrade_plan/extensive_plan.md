# Extensive Plan for YAMCP-UI MCP Hub Upgrade

This plan details the steps to enhance `yamcp-ui-dockerized` by extending its backend (`server.mjs`) to act as an MCP Hub, managed by PM2 for reliability and hot-reloading.

## Phase 1: Preparation and Setup

1.  **Create a New Git Branch:**
    *   All work will be done on a new branch, e.g., `feature/mcp-hub-pm2`.
    *   Command: `git checkout -b feature/mcp-hub-pm2` (To be run by user or Cline in ACT mode)

2.  **Install PM2 and `yamcp` Globally in Dockerfile:**
    *   Modify `docker/Dockerfile`.
    *   Add `pm2` and `yamcp` to the global npm installations.
    ```dockerfile
    # Current: RUN npm install -g concurrently
    # Change to:
    RUN npm install -g concurrently pm2 yamcp
    ```

3.  **Update Docker CMD to Use PM2:**
    *   Modify `docker/Dockerfile`.
    *   The `server.mjs` part of `concurrently` will now be `pm2-runtime start /app/ecosystem.config.js`.
    ```dockerfile
    # Current CMD:
    # CMD ["concurrently", "-n", "frontend,backend", "-c", "cyan,green", \
    #      "npm run dev -- --host 0.0.0.0", \
    #      "npm start"]
    # Change to:
    CMD ["concurrently", "-n", "frontend,backend-hub", "-c", "cyan,green", \
         "npm run dev -- --host 0.0.0.0", \
         "pm2-runtime start /app/ecosystem.config.js"]
    ```

4.  **Create `ecosystem.config.js` for PM2:**
    *   Create this file in the project root (`/home/ai/test/yamcp-ui/ecosystem.config.js`).
    *   This file will configure PM2 to manage `server.mjs`.
    ```javascript
    // ecosystem.config.js
    module.exports = {
      apps: [{
        name: 'yamcp-ui-backend-hub',
        script: 'server.mjs', // Assumes server.mjs is in /app
        cwd: '/app',           // Set CWD for server.mjs
        instances: 1,
        autorestart: true,
        watch: [ // Paths are relative to CWD or absolute within container
          '/root/.local/share/yamcp-nodejs/providers.json',
          '/root/.local/share/yamcp-nodejs/workspaces.json'
        ],
        watch_delay: 1000,
        ignore_watch: [
          'node_modules',
          'src',
          'dist',
          'docker',
          '*.log',
          'upgrade_plan', // Ignore the plan directory
          '.git'
        ],
        max_memory_restart: '500M',
        log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
        error_file: '/dev/stderr',
        out_file: '/dev/stdout',
        min_uptime: '10s',
        max_restarts: 5,
        restart_delay: 4000,
        exp_backoff_restart_delay: 100
      }]
    };
    ```

5.  **Ensure `ecosystem.config.js` is Copied in Dockerfile:**
    *   The `COPY . .` command in `docker/Dockerfile` should already handle this if `ecosystem.config.js` is in the project root. Verify this.

6.  **Update `docker-compose.yml` for Port Binding (if needed):**
    *   Ensure port `8765` (for `server.mjs` API and new SSE hub) is bound to `0.0.0.0` to be accessible on the local network. This should already be the case from previous steps.
    ```yaml
    # In test/yamcp-ui/docker/docker-compose.yml
    ports:
      - "5173:5173"  # Vite dev server (frontend) - consider 0.0.0.0:5173:5173
      - "0.0.0.0:8765:8765"  # Express server (backend API + MCP Hub SSE)
    ```

## Phase 2: Modify `server.mjs` to Implement MCP Hub Logic

1.  **Import `spawn` from `child_process` (if not already):**
    *   Located at `/home/ai/test/yamcp-ui/server.mjs`.
    ```javascript
    import { spawn } from 'child_process';
    // fs might also be needed if not already imported
    import fs from 'fs';
    ```

2.  **Store Active MCP Processes:**
    *   Add near the top of `server.mjs`.
    ```javascript
    const activeMcpProcesses = new Map(); // Key: workspaceName, Value: child_process instance
    ```

3.  **Create SSE Endpoint `/mcp/:workspaceName`:**
    *   Add this new route to the Express `app` instance in `server.mjs`.
    ```javascript
    app.get('/mcp/:workspaceName', (req, res) => {
      const { workspaceName } = req.params;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*'); // Consider making this configurable
      res.flushHeaders();

      // Optional: Check if workspace actually exists using getRealWorkspaces()
      // This requires getRealWorkspaces to be accessible here.
      // If it's not, this check can be skipped, and `yamcp run` will fail if invalid.

      if (activeMcpProcesses.has(workspaceName)) {
        const oldProcess = activeMcpProcesses.get(workspaceName);
        if (!oldProcess.killed) {
          oldProcess.kill('SIGTERM');
        }
        activeMcpProcesses.delete(workspaceName);
        res.write(`event: info\ndata: {"message": "Restarting workspace ${workspaceName} due to new connection."}\n\n`);
      }

      const mcpProcess = spawn('yamcp', ['run', workspaceName], { stdio: 'pipe' });
      activeMcpProcesses.set(workspaceName, mcpProcess);

      res.write(`event: info\ndata: {"message": "Attempting to start workspace: ${workspaceName}"}\n\n`);

      mcpProcess.stdout.on('data', (data) => {
        data.toString().split(/\\r\\n|\\n|\\r/).forEach(line => { // Handle different line endings
          if (line.trim()) res.write(`data: ${line.trim()}\n\n`);
        });
      });

      mcpProcess.stderr.on('data', (data) => {
        data.toString().split(/\\r\\n|\\n|\\r/).forEach(line => {
          if (line.trim()) res.write(`event: error\ndata: {"message": "stderr: ${line.trim()}"}\n\n`);
        });
      });

      mcpProcess.on('error', (err) => {
        console.error(`MCP process error for ${workspaceName}: ${err.message}`);
        res.write(`event: error\ndata: {"message": "Failed to start workspace ${workspaceName}: ${err.message}"}\n\n`);
        activeMcpProcesses.delete(workspaceName);
        // Consider not ending res here to allow client to see the error and then handle disconnect
      });

      mcpProcess.on('close', (code) => {
        console.log(`MCP process for ${workspaceName} exited with code ${code}.`);
        res.write(`event: close\ndata: {"message": "Workspace ${workspaceName} connection closed. Exit code: ${code}"}\n\n`);
        activeMcpProcesses.delete(workspaceName);
        res.end(); // Essential to close the SSE stream from server-side
      });

      req.on('close', () => { // Client disconnected
        console.log(`Client disconnected from SSE for workspace ${workspaceName}.`);
        if (activeMcpProcesses.has(workspaceName)) {
          const procToKill = activeMcpProcesses.get(workspaceName);
          if (!procToKill.killed) {
            procToKill.kill('SIGTERM');
            console.log(`Killed MCP process for ${workspaceName} due to client disconnect.`);
          }
          activeMcpProcesses.delete(workspaceName);
        }
      });
    });
    ```

4.  **Graceful Shutdown Logic for `server.mjs`:**
    *   Add this towards the end of `server.mjs`, before `startServer()`.
    ```javascript
    function gracefulShutdown(signal) {
      console.log(`Received ${signal}. Shutting down MCP Hub gracefully...`);
      activeMcpProcesses.forEach((proc, name) => {
        if (!proc.killed) {
          console.log(`Terminating MCP process for workspace: ${name}`);
          proc.kill('SIGTERM');
        }
      });
      // Allow a short time for processes to terminate
      setTimeout(() => {
        console.log('All active MCP processes signaled. Exiting main process.');
        process.exit(0);
      }, 1500); // Adjust as needed
    }

    // PM2 sends SIGINT. Docker stop sends SIGTERM.
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    ```
    *   Ensure `startServer()` is the last effective call or that this shutdown logic is registered before the server starts listening.

## Phase 3: Testing and Refinement

1.  **Build the Docker Image:**
    *   `cd /home/ai/test/yamcp-ui/docker`
    *   `docker-compose build`

2.  **Run the Docker Container:**
    *   `docker-compose up` (to see logs directly, or `-d` for detached)

3.  **Verify PM2 Operation:**
    *   Check `docker-compose logs -f yamcp-ui-dev`.
    *   See PM2 starting `yamcp-ui-backend-hub`.
    *   Exec into container: `docker exec -it yamcp-ui-dev sh` (or actual container name).
    *   Inside: `pm2 list` and `pm2 logs yamcp-ui-backend-hub --lines 50`.

4.  **Test UI and Config Saving:**
    *   Access `yamcp-ui` frontend (e.g., `http://localhost:5173`).
    *   Create/modify an MCP server and a workspace. Save it.
    *   Check PM2 logs. PM2 should detect changes to `/root/.local/share/yamcp-nodejs/*.json` and restart `server.mjs`.

5.  **Test SSE Endpoint:**
    *   Use `curl -N http://localhost:8765/mcp/your_workspace_name` or an SSE client tool.
    *   Verify `yamcp run your_workspace_name` starts and output is streamed.
    *   Verify client disconnect terminates the `yamcp run` process.
    *   Test with an invalid workspace name.

6.  **Test Hot Reloading with Active SSE Connection:**
    *   Connect via SSE.
    *   Modify config via UI.
    *   PM2 restarts `server.mjs`. SSE connection should drop.
    *   New SSE connection should use new config.

7.  **Test Reliability:**
    *   Inside container, `pm2 stop yamcp-ui-backend-hub`. Then `pm2 restart yamcp-ui-backend-hub`.
    *   Try to cause an error in a `yamcp run` process if possible.

8.  **Review and Refine:**
    *   Check for resource leaks.
    *   Optimize logging.

## Phase 4: Documentation and Finalization

1.  **Update `README.md`:**
    *   Explain new MCP Hub at `http://localhost:8765/mcp/:workspaceName`.
    *   Mention PM2's role.
    *   Explain SSE connection drop on hot reloads.

2.  **Commit Final Changes:**
    *   `git add .`
    *   `git commit -m "feat: Implement MCP Hub in server.mjs with PM2 management"`
    *   `git push origin feature/mcp-hub-pm2`

This plan provides a detailed roadmap.
