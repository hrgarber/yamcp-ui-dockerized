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
    error_file: 'err.log',
    out_file: 'out.log',
    combine_logs: true,
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100
  }]
};