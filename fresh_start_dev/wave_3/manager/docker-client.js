import Docker from 'dockerode';
import winston from 'winston';

// Import error handling - we'll create a local helper for now
const createErrorResponse = (code, data = null) => {
  const error = new Error(code);
  error.code = code;
  error.data = data;
  return error;
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * DockerClient handles all Docker container operations for workspaces
 */
export class DockerClient {
  constructor(options = {}) {
    this.docker = new Docker({
      socketPath: options.socketPath || process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    });
    this.workspaceImage = options.workspaceImage || process.env.WORKSPACE_IMAGE || 'mcp-workspace:latest';
    this.networkName = options.networkName || 'mcp-network';
    this.containerPrefix = 'mcp-workspace-';
  }

  /**
   * Initialize Docker client and ensure prerequisites
   */
  async initialize() {
    try {
      // Test Docker connection
      await this.docker.ping();
      logger.info('Docker connection established');

      // Ensure network exists
      await this.ensureNetwork();
      
      // Clean up orphaned containers
      await this.cleanupOrphans();
    } catch (error) {
      logger.error('Failed to initialize Docker client:', error);
      throw error;
    }
  }

  /**
   * Ensure Docker network exists for workspace containers
   */
  async ensureNetwork() {
    try {
      const networks = await this.docker.listNetworks();
      const exists = networks.some(net => net.Name === this.networkName);
      
      if (!exists) {
        logger.info(`Creating network ${this.networkName}`);
        await this.docker.createNetwork({
          Name: this.networkName,
          Driver: 'bridge',
          Labels: {
            'mcp.workspace': 'true',
          },
        });
      } else {
        logger.info(`Network ${this.networkName} already exists`);
      }
    } catch (error) {
      logger.error('Failed to ensure network:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned workspace containers
   */
  async cleanupOrphans(trackedWorkspaceIds = []) {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const workspaceContainers = containers.filter(container =>
        container.Names.some(name => name.startsWith(`/${this.containerPrefix}`))
      );

      const trackedSet = new Set(trackedWorkspaceIds);
      let cleaned = 0;
      let preserved = 0;

      for (const containerInfo of workspaceContainers) {
        try {
          // Extract workspace ID from container name
          const containerName = containerInfo.Names[0];
          const workspaceId = containerName.substring(`/${this.containerPrefix}`.length);
          
          // Check if this container is tracked
          if (trackedSet.has(workspaceId)) {
            preserved++;
            logger.debug(`Preserved tracked container: ${containerName}`);
            continue;
          }
          
          // Check container age - don't remove containers created in the last 5 minutes
          const created = new Date(containerInfo.Created * 1000);
          const ageMinutes = (Date.now() - created.getTime()) / (1000 * 60);
          
          if (ageMinutes < 5) {
            logger.info(`Skipping recently created container: ${containerName} (${ageMinutes.toFixed(1)} minutes old)`);
            continue;
          }
          
          // This is an orphaned container
          logger.info(`Found orphaned container: ${containerName} (${containerInfo.State})`);
          
          const container = this.docker.getContainer(containerInfo.Id);
          
          // Stop if running
          if (containerInfo.State === 'running') {
            logger.info(`Stopping orphaned container: ${containerName}`);
            await container.stop({ t: 10 });
          }
          
          // Remove container
          await container.remove({ force: true });
          cleaned++;
          logger.info(`Removed orphaned container: ${containerName}`);
        } catch (error) {
          logger.warn(`Failed to cleanup container ${containerInfo.Id}:`, error.message);
        }
      }

      if (cleaned > 0 || preserved > 0) {
        logger.info(`Container cleanup complete: ${cleaned} removed, ${preserved} preserved`);
      }
    } catch (error) {
      logger.error('Failed to cleanup orphans:', error);
      // Don't throw - cleanup failures shouldn't block initialization
    }
  }

  /**
   * Create and start a workspace container
   */
  async createWorkspace(id, config, port) {
    const containerName = `${this.containerPrefix}${id}`;
    
    try {
      // Check if container already exists
      const existing = await this.getContainer(containerName);
      if (existing) {
        throw createErrorResponse('WORKSPACE_ALREADY_EXISTS', { id });
      }
    } catch (error) {
      if (error.statusCode !== 404 && !error.error?.code) {
        throw error;
      }
    }

    try {
      logger.info(`Creating workspace ${id} on port ${port}`);
      
      // Prepare environment variables using the validator
      const configValidator = new (await import('./config-validator.js')).ConfigValidator();
      const env = configValidator.configToEnv(config);

      // Prepare resource limits
      const resources = config.resources || {};
      const memoryLimit = this.parseMemoryLimit(resources.memory || '512m');
      const cpuQuota = Math.floor((resources.cpu || 0.5) * 100000); // Convert to microseconds

      // Create container
      const container = await this.docker.createContainer({
        name: containerName,
        Image: this.workspaceImage,
        Env: env,
        ExposedPorts: {
          '8080/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '8080/tcp': [{ HostPort: port.toString() }]
          },
          RestartPolicy: {
            Name: 'unless-stopped',
            MaximumRetryCount: 5
          },
          Memory: memoryLimit,
          CpuQuota: cpuQuota,
          CpuPeriod: 100000,
          NetworkMode: this.networkName,
        },
        Labels: {
          'mcp.workspace': 'true',
          'mcp.workspace.id': id,
          'mcp.workspace.name': config.name,
          'mcp.workspace.port': port.toString(),
        }
      });

      // Start container
      await container.start();
      logger.info(`Started workspace container ${id}`);

      return {
        id: container.id,
        name: containerName,
        port,
        status: 'running',
      };
    } catch (error) {
      logger.error(`Failed to create workspace ${id}:`, error);
      throw createErrorResponse('DOCKER_CONTAINER_CREATE_FAILED', { 
        id, 
        error: error.message 
      });
    }
  }

  /**
   * Stop a workspace container
   */
  async stopWorkspace(id) {
    const containerName = `${this.containerPrefix}${id}`;
    
    try {
      logger.info(`Stopping workspace ${id}`);
      const container = await this.getContainer(containerName);
      
      if (!container) {
        throw createErrorResponse('DOCKER_CONTAINER_NOT_FOUND', { id });
      }

      await container.stop({ t: 10 }); // 10 second timeout
      logger.info(`Stopped workspace container ${id}`);
      
      return { id, status: 'stopped' };
    } catch (error) {
      if (error.statusCode === 304) {
        // Container already stopped
        return { id, status: 'stopped' };
      }
      logger.error(`Failed to stop workspace ${id}:`, error);
      throw createErrorResponse('DOCKER_CONTAINER_STOP_FAILED', { 
        id, 
        error: error.message 
      });
    }
  }

  /**
   * Remove a workspace container
   */
  async removeWorkspace(id) {
    const containerName = `${this.containerPrefix}${id}`;
    
    try {
      logger.info(`Removing workspace ${id}`);
      const container = await this.getContainer(containerName);
      
      if (!container) {
        throw createErrorResponse('DOCKER_CONTAINER_NOT_FOUND', { id });
      }

      // Stop if running
      const info = await container.inspect();
      if (info.State.Running) {
        await container.stop({ t: 10 });
      }

      await container.remove({ force: true });
      logger.info(`Removed workspace container ${id}`);
      
      return { id, removed: true };
    } catch (error) {
      logger.error(`Failed to remove workspace ${id}:`, error);
      throw createErrorResponse('DOCKER_CONTAINER_REMOVE_FAILED', { 
        id, 
        error: error.message 
      });
    }
  }

  /**
   * Get workspace container info
   */
  async getWorkspaceInfo(id) {
    const containerName = `${this.containerPrefix}${id}`;
    
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        throw createErrorResponse('DOCKER_CONTAINER_NOT_FOUND', { id });
      }

      const info = await container.inspect();
      
      return {
        id: info.Id,
        name: info.Name.substring(1), // Remove leading /
        status: info.State.Status,
        running: info.State.Running,
        startedAt: info.State.StartedAt,
        port: info.Labels['mcp.workspace.port'],
        config: this.extractConfigFromEnv(info.Config.Env),
        resources: {
          memory: this.formatMemoryLimit(info.HostConfig.Memory),
          cpu: info.HostConfig.CpuQuota / 100000,
        },
        health: info.State.Health || null,
      };
    } catch (error) {
      if (error.error?.code) {
        throw error;
      }
      logger.error(`Failed to get workspace info ${id}:`, error);
      throw createErrorResponse('INTERNAL_ERROR', { 
        id, 
        error: error.message 
      });
    }
  }

  /**
   * List all workspace containers
   */
  async listWorkspaces() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const workspaceContainers = containers.filter(container =>
        container.Names.some(name => name.startsWith(`/${this.containerPrefix}`))
      );

      return workspaceContainers.map(container => ({
        id: container.Names[0].substring(this.containerPrefix.length + 1), // Remove prefix and /
        containerId: container.Id,
        status: container.State,
        running: container.State === 'running',
        port: container.Labels['mcp.workspace.port'],
        name: container.Labels['mcp.workspace.name'],
        created: new Date(container.Created * 1000).toISOString(),
      }));
    } catch (error) {
      logger.error('Failed to list workspaces:', error);
      throw createErrorResponse('INTERNAL_ERROR', { 
        error: error.message 
      });
    }
  }

  /**
   * Restart a workspace container
   */
  async restartWorkspace(id) {
    const containerName = `${this.containerPrefix}${id}`;
    
    try {
      logger.info(`Restarting workspace ${id}`);
      const container = await this.getContainer(containerName);
      
      if (!container) {
        throw createErrorResponse('DOCKER_CONTAINER_NOT_FOUND', { id });
      }

      await container.restart({ t: 10 }); // 10 second timeout
      logger.info(`Restarted workspace container ${id}`);
      
      return { id, status: 'running' };
    } catch (error) {
      logger.error(`Failed to restart workspace ${id}:`, error);
      throw createErrorResponse('DOCKER_CONTAINER_START_FAILED', { 
        id, 
        error: error.message 
      });
    }
  }

  /**
   * Helper: Get container by name
   */
  async getContainer(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      await container.inspect(); // Verify it exists
      return container;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Helper: Parse memory limit string to bytes
   */
  parseMemoryLimit(memory) {
    const match = memory.match(/^(\d+)(m|g)$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit === 'g' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024;
  }

  /**
   * Helper: Format memory limit from bytes
   */
  formatMemoryLimit(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024 * 1024))}g`;
    }
    return `${Math.round(bytes / (1024 * 1024))}m`;
  }

  /**
   * Helper: Expand environment variables
   */
  expandEnvVars(value) {
    return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw createErrorResponse('CONFIG_ENV_VAR_UNDEFINED', { 
          variable: varName 
        });
      }
      return envValue;
    });
  }

  /**
   * Helper: Extract config from environment
   */
  extractConfigFromEnv(env) {
    const configVar = env.find(e => e.startsWith('WORKSPACE_CONFIG='));
    if (configVar) {
      try {
        return JSON.parse(configVar.substring('WORKSPACE_CONFIG='.length));
      } catch (error) {
        logger.warn('Failed to parse workspace config:', error);
      }
    }
    return null;
  }
}

export default DockerClient;