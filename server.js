const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Create Express app
const app = express();
const port = process.env.PORT || 3000;
const managerUrl = process.env.MANAGER_URL || 'http://localhost:3001';

// Middleware for parsing JSON
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy configuration for manager service
const managerProxy = createProxyMiddleware({
  target: managerUrl,
  changeOrigin: true,
  ws: true, // Enable WebSocket support
  logLevel: 'debug',
  onError: (err, req, res) => {
    logger.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Manager service unavailable',
        message: 'Unable to connect to workspace manager service',
        details: err.message
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.debug(`Proxying ${req.method} ${req.path} to ${managerUrl}`);
  }
});

// SSE-specific proxy configuration
const sseProxy = createProxyMiddleware({
  target: managerUrl,
  changeOrigin: true,
  ws: false,
  logLevel: 'debug',
  onError: (err, req, res) => {
    logger.error('SSE Proxy error:', err);
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: 'Manager service unavailable',
        message: err.message 
      })}\n\n`);
      res.end();
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Ensure SSE headers are preserved
    if (req.path.includes('/sse') || req.headers.accept === 'text/event-stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    }
  }
});

// Proxy all /api/workspaces/* requests to manager service
app.use('/api/workspaces', (req, res, next) => {
  // Use SSE proxy for SSE endpoints
  if (req.path.includes('/sse') || req.headers.accept === 'text/event-stream') {
    return sseProxy(req, res, next);
  }
  // Use regular proxy for other requests
  return managerProxy(req, res, next);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  // Catch-all handler for React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  // In development, only handle API routes
  app.get('/', (req, res) => {
    res.json({
      message: 'YAMCP UI Server (Development Mode)',
      endpoints: {
        health: '/health',
        workspaces: '/api/workspaces/*'
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Manager service URL: ${managerUrl}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;