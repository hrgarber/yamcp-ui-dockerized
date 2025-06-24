import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import dotenv from 'dotenv';
import { DockerClient } from './docker-client.js';
import { ConfigValidator } from './config-validator.js';
import { PortManager } from './port-manager.js';
import { HealthMonitor } from './health-monitor.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Initialize service components
let dockerClient;
let configValidator;
let portManager;
let healthMonitor;

// Workspace state tracking
const workspaceStates = new Map(); // workspaceId -> { name, config, port, status }

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Workspace endpoints

// Create workspace
app.post('/api/workspaces', async (req, res) => {
  try {
    const { name, config } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Both name and config are required' 
      });
    }
    
    // Generate workspace ID
    const workspaceId = `${name}-${Date.now()}`;
    
    // Check if workspace already exists
    if (workspaceStates.has(workspaceId)) {
      return res.status(409).json({ 
        error: 'Workspace already exists', 
        workspaceId 
      });
    }
    
    // Validate configuration
    const validation = configValidator.validate(config);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid configuration', 
        errors: validation.errors 
      });
    }
    
    // Allocate port
    const port = await portManager.allocatePort(workspaceId);
    
    try {
      // Create container
      const containerInfo = await dockerClient.createWorkspace(workspaceId, config, port);
      
      // Track workspace state
      workspaceStates.set(workspaceId, {
        name,
        config,
        port,
        status: 'running',
        containerId: containerInfo.id,
        created: new Date().toISOString(),
      });
      
      // Add to health monitoring
      healthMonitor.addWorkspace(workspaceId, port);
      
      logger.info(`Created workspace ${workspaceId}`);
      
      res.status(201).json({
        workspaceId,
        name,
        port,
        status: 'running',
        config,
        url: `http://localhost:${port}`,
      });
    } catch (error) {
      // Cleanup on failure
      await portManager.releasePort(workspaceId);
      throw error;
    }
  } catch (error) {
    logger.error('Failed to create workspace:', error);
    res.status(500).json({ 
      error: 'Failed to create workspace', 
      details: error.message 
    });
  }
});

// List workspaces
app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = [];
    const healthStatus = healthMonitor.getStatus();
    
    for (const [workspaceId, state] of workspaceStates) {
      const containerInfo = await dockerClient.getWorkspaceInfo(workspaceId).catch(() => null);
      const health = healthStatus[workspaceId];
      
      workspaces.push({
        workspaceId,
        name: state.name,
        port: state.port,
        status: containerInfo?.status || 'unknown',
        created: state.created,
        health: health || { status: 'unknown' },
        url: `http://localhost:${state.port}`,
      });
    }
    
    res.json({ workspaces });
  } catch (error) {
    logger.error('Failed to list workspaces:', error);
    res.status(500).json({ 
      error: 'Failed to list workspaces', 
      details: error.message 
    });
  }
});

// Get workspace details
app.get('/api/workspaces/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Find workspace by name or ID
    let workspaceId = null;
    let state = null;
    
    for (const [id, ws] of workspaceStates) {
      if (id === name || ws.name === name) {
        workspaceId = id;
        state = ws;
        break;
      }
    }
    
    if (!workspaceId || !state) {
      return res.status(404).json({ 
        error: 'Workspace not found', 
        name 
      });
    }
    
    const containerInfo = await dockerClient.getWorkspaceInfo(workspaceId);
    const health = healthMonitor.getWorkspaceStatus(workspaceId);
    
    res.json({
      workspaceId,
      name: state.name,
      port: state.port,
      status: containerInfo.status,
      config: state.config,
      created: state.created,
      container: {
        id: containerInfo.id,
        running: containerInfo.running,
        startedAt: containerInfo.startedAt,
        resources: containerInfo.resources,
      },
      health: health || { status: 'unknown' },
      url: `http://localhost:${state.port}`,
    });
  } catch (error) {
    logger.error('Failed to get workspace details:', error);
    
    if (error.code === 'DOCKER_CONTAINER_NOT_FOUND') {
      return res.status(404).json({ 
        error: 'Workspace container not found', 
        name: req.params.name 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get workspace details', 
      details: error.message 
    });
  }
});

// Update workspace
app.put('/api/workspaces/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ 
        error: 'Missing configuration' 
      });
    }
    
    // Find workspace by name or ID
    let workspaceId = null;
    let state = null;
    
    for (const [id, ws] of workspaceStates) {
      if (id === name || ws.name === name) {
        workspaceId = id;
        state = ws;
        break;
      }
    }
    
    if (!workspaceId || !state) {
      return res.status(404).json({ 
        error: 'Workspace not found', 
        name 
      });
    }
    
    // Validate new configuration
    const validation = configValidator.validate(config);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid configuration', 
        errors: validation.errors 
      });
    }
    
    // Stop current container
    await dockerClient.stopWorkspace(workspaceId);
    await dockerClient.removeWorkspace(workspaceId);
    
    // Remove from health monitoring temporarily
    healthMonitor.removeWorkspace(workspaceId);
    
    // Create new container with updated config
    const containerInfo = await dockerClient.createWorkspace(workspaceId, config, state.port);
    
    // Update state
    state.config = config;
    state.status = 'running';
    state.containerId = containerInfo.id;
    
    // Re-add to health monitoring
    healthMonitor.addWorkspace(workspaceId, state.port);
    
    logger.info(`Updated workspace ${workspaceId}`);
    
    res.json({
      workspaceId,
      name: state.name,
      port: state.port,
      status: 'running',
      config,
      url: `http://localhost:${state.port}`,
    });
  } catch (error) {
    logger.error('Failed to update workspace:', error);
    res.status(500).json({ 
      error: 'Failed to update workspace', 
      details: error.message 
    });
  }
});

// Delete workspace
app.delete('/api/workspaces/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Find workspace by name or ID
    let workspaceId = null;
    let state = null;
    
    for (const [id, ws] of workspaceStates) {
      if (id === name || ws.name === name) {
        workspaceId = id;
        state = ws;
        break;
      }
    }
    
    if (!workspaceId || !state) {
      return res.status(404).json({ 
        error: 'Workspace not found', 
        name 
      });
    }
    
    // Remove from health monitoring
    healthMonitor.removeWorkspace(workspaceId);
    
    // Remove container
    await dockerClient.removeWorkspace(workspaceId);
    
    // Release port
    await portManager.releasePort(workspaceId);
    
    // Remove from state tracking
    workspaceStates.delete(workspaceId);
    
    logger.info(`Deleted workspace ${workspaceId}`);
    
    res.json({
      workspaceId,
      name: state.name,
      deleted: true,
    });
  } catch (error) {
    logger.error('Failed to delete workspace:', error);
    res.status(500).json({ 
      error: 'Failed to delete workspace', 
      details: error.message 
    });
  }
});

// Get workspace status
app.get('/api/workspaces/:name/status', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Find workspace by name or ID
    let workspaceId = null;
    let state = null;
    
    for (const [id, ws] of workspaceStates) {
      if (id === name || ws.name === name) {
        workspaceId = id;
        state = ws;
        break;
      }
    }
    
    if (!workspaceId || !state) {
      return res.status(404).json({ 
        error: 'Workspace not found', 
        name 
      });
    }
    
    const containerInfo = await dockerClient.getWorkspaceInfo(workspaceId);
    const health = healthMonitor.getWorkspaceStatus(workspaceId);
    
    res.json({
      workspaceId,
      name: state.name,
      container: {
        status: containerInfo.status,
        running: containerInfo.running,
        startedAt: containerInfo.startedAt,
      },
      health: health || { status: 'unknown' },
      port: state.port,
      url: `http://localhost:${state.port}`,
    });
  } catch (error) {
    logger.error('Failed to get workspace status:', error);
    res.status(500).json({ 
      error: 'Failed to get workspace status', 
      details: error.message 
    });
  }
});

// Get workspace logs
app.get('/api/workspaces/:name/logs', async (req, res) => {
  try {
    const { name } = req.params;
    const { tail = '100', timestamps = 'true' } = req.query;
    
    // Find workspace by name or ID
    let workspaceId = null;
    
    for (const [id, ws] of workspaceStates) {
      if (id === name || ws.name === name) {
        workspaceId = id;
        break;
      }
    }
    
    if (!workspaceId) {
      return res.status(404).json({ 
        error: 'Workspace not found', 
        name 
      });
    }
    
    const containerName = `mcp-workspace-${workspaceId}`;
    const container = dockerClient.docker.getContainer(containerName);
    
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      timestamps: timestamps === 'true',
    });
    
    // Convert buffer to string
    const logString = logs.toString('utf8');
    
    res.json({
      workspaceId,
      logs: logString.split('\n').filter(line => line.trim()),
    });
  } catch (error) {
    logger.error('Failed to get workspace logs:', error);
    res.status(500).json({ 
      error: 'Failed to get workspace logs', 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize Docker client
    dockerClient = new DockerClient();
    await dockerClient.initialize();
    logger.info('Docker client initialized');
    
    // Initialize config validator
    configValidator = new ConfigValidator();
    logger.info('Config validator initialized');
    
    // Initialize port manager
    portManager = new PortManager();
    await portManager.initialize();
    logger.info('Port manager initialized');
    
    // Initialize health monitor
    healthMonitor = new HealthMonitor(dockerClient);
    healthMonitor.start();
    logger.info('Health monitor started');
    
    // Restore workspace states from running containers
    await restoreWorkspaceStates();
    
    // Schedule periodic cleanup of orphaned containers
    schedulePeriodicCleanup();
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Store cleanup interval ID for graceful shutdown
let cleanupIntervalId = null;

// Schedule periodic cleanup of orphaned containers
function schedulePeriodicCleanup() {
  // Run cleanup every 5 minutes
  const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS || '300000'); // 5 minutes
  
  cleanupIntervalId = setInterval(async () => {
    try {
      logger.debug('Running periodic orphaned container cleanup');
      const trackedIds = Array.from(workspaceStates.keys());
      await dockerClient.cleanupOrphans(trackedIds);
      
      // Also cleanup stale port allocations
      await portManager.cleanup(trackedIds);
    } catch (error) {
      logger.error('Periodic cleanup failed:', error);
    }
  }, cleanupInterval);
  
  logger.info(`Scheduled periodic cleanup every ${cleanupInterval / 1000} seconds`);
}

// Restore workspace states from running containers
async function restoreWorkspaceStates() {
  try {
    const containers = await dockerClient.listWorkspaces();
    
    for (const container of containers) {
      const workspaceId = container.id;
      const port = parseInt(container.port);
      
      if (workspaceId && port) {
        workspaceStates.set(workspaceId, {
          name: container.name || workspaceId,
          config: null, // Will be loaded from container
          port,
          status: container.status,
          containerId: container.containerId,
          created: container.created,
        });
        
        // Add to health monitoring if running
        if (container.running) {
          healthMonitor.addWorkspace(workspaceId, port);
        }
        
        logger.info(`Restored workspace state: ${workspaceId}`);
      }
    }
    
    logger.info(`Restored ${workspaceStates.size} workspace states`);
  } catch (error) {
    logger.error('Failed to restore workspace states:', error);
    // Don't fail startup if we can't restore states
  }
}

// Start server
const server = app.listen(port, async () => {
  logger.info(`Manager service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize services after server starts
  await initializeServices();
});

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Starting graceful shutdown');
  
  // Stop periodic cleanup
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    logger.info('Periodic cleanup stopped');
  }
  
  // Stop health monitor
  if (healthMonitor) {
    healthMonitor.stop();
    logger.info('Health monitor stopped');
  }
  
  // Save port allocations
  if (portManager) {
    await portManager.saveAllocations();
    logger.info('Port allocations saved');
  }
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;