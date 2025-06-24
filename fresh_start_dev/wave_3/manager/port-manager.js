import { promises as fs } from 'fs';
import path from 'path';
import portfinder from 'portfinder';
import winston from 'winston';
import { createErrorResponse } from '../shared/error-codes.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * PortManager handles unique port allocation for workspace containers
 */
export class PortManager {
  constructor(options = {}) {
    this.startPort = parseInt(options.startPort || process.env.PORT_RANGE_START || '9000');
    this.endPort = parseInt(options.endPort || process.env.PORT_RANGE_END || '9999');
    this.storageFile = options.storageFile || process.env.PORT_ALLOCATION_FILE || './ports.json';
    this.allocations = new Map();
    this.lockFile = `${this.storageFile}.lock`;
  }

  /**
   * Initialize port manager and load existing allocations
   */
  async initialize() {
    try {
      await this.loadAllocations();
      logger.info(`Port manager initialized with range ${this.startPort}-${this.endPort}`);
    } catch (error) {
      logger.error('Failed to initialize port manager:', error);
      throw error;
    }
  }

  /**
   * Load port allocations from storage
   */
  async loadAllocations() {
    try {
      const data = await fs.readFile(this.storageFile, 'utf8');
      const allocations = JSON.parse(data);
      this.allocations = new Map(Object.entries(allocations));
      logger.info(`Loaded ${this.allocations.size} port allocations`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start with empty allocations
      this.allocations = new Map();
    }
  }

  /**
   * Save port allocations to storage
   */
  async saveAllocations() {
    try {
      const data = Object.fromEntries(this.allocations);
      await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
      logger.info('Port allocations saved');
    } catch (error) {
      logger.error('Failed to save port allocations:', error);
      throw createErrorResponse('PORT_STORAGE_FAILED', {
        error: error.message,
      });
    }
  }

  /**
   * Allocate a port for a workspace
   */
  async allocatePort(workspaceId) {
    // Check if already allocated
    if (this.allocations.has(workspaceId)) {
      const port = this.allocations.get(workspaceId);
      logger.info(`Reusing port ${port} for workspace ${workspaceId}`);
      return port;
    }

    try {
      // Get all allocated ports
      const allocatedPorts = Array.from(this.allocations.values());
      
      // Find available port
      let port = null;
      for (let p = this.startPort; p <= this.endPort; p++) {
        if (!allocatedPorts.includes(p)) {
          // Check if port is actually available on the system
          try {
            const availablePort = await portfinder.getPortPromise({
              port: p,
              stopPort: p,
            });
            if (availablePort === p) {
              port = p;
              break;
            }
          } catch (error) {
            // Port not available, continue searching
            continue;
          }
        }
      }

      if (!port) {
        throw createErrorResponse('PORT_RANGE_EXHAUSTED', {
          startPort: this.startPort,
          endPort: this.endPort,
          allocated: allocatedPorts.length,
        });
      }

      // Allocate port
      this.allocations.set(workspaceId, port);
      await this.saveAllocations();
      logger.info(`Allocated port ${port} to workspace ${workspaceId}`);
      
      return port;
    } catch (error) {
      if (error.error?.code) {
        throw error;
      }
      logger.error(`Failed to allocate port for workspace ${workspaceId}:`, error);
      throw createErrorResponse('PORT_ALLOCATION_FAILED', {
        workspaceId,
        error: error.message,
      });
    }
  }

  /**
   * Release a port allocation
   */
  async releasePort(workspaceId) {
    if (!this.allocations.has(workspaceId)) {
      logger.warn(`No port allocation found for workspace ${workspaceId}`);
      return;
    }

    const port = this.allocations.get(workspaceId);
    this.allocations.delete(workspaceId);
    await this.saveAllocations();
    logger.info(`Released port ${port} from workspace ${workspaceId}`);
  }

  /**
   * Get port for a workspace
   */
  getPort(workspaceId) {
    return this.allocations.get(workspaceId);
  }

  /**
   * Get all allocations
   */
  getAllocations() {
    return new Map(this.allocations);
  }

  /**
   * Check if a port is available
   */
  isPortAvailable(port) {
    const allocatedPorts = Array.from(this.allocations.values());
    return !allocatedPorts.includes(port) && port >= this.startPort && port <= this.endPort;
  }

  /**
   * Clean up allocations for non-existent workspaces
   */
  async cleanup(existingWorkspaceIds) {
    const existingSet = new Set(existingWorkspaceIds);
    const toRemove = [];

    for (const [workspaceId] of this.allocations) {
      if (!existingSet.has(workspaceId)) {
        toRemove.push(workspaceId);
      }
    }

    for (const workspaceId of toRemove) {
      await this.releasePort(workspaceId);
    }

    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} stale port allocations`);
    }
  }
}

export default PortManager;