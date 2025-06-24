import { promises as fs } from 'fs';
import path from 'path';
import portfinder from 'portfinder';
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
      
      // Validate the loaded data
      if (!this.validateAllocations(allocations)) {
        throw new Error('Invalid port allocations data structure');
      }
      
      this.allocations = new Map(Object.entries(allocations));
      logger.info(`Loaded ${this.allocations.size} port allocations`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start with empty allocations
        this.allocations = new Map();
        return;
      }
      
      // Handle corrupted file or invalid JSON
      logger.error('Failed to load port allocations:', error);
      
      // Try to restore from backup
      try {
        await this.restoreFromBackup();
        logger.info('Successfully restored from backup after load failure');
      } catch (backupError) {
        logger.warn('No valid backup available, starting with empty allocations');
        this.allocations = new Map();
        
        // Move corrupted file aside
        try {
          const corruptedFile = `${this.storageFile}.corrupted.${Date.now()}`;
          await fs.rename(this.storageFile, corruptedFile);
          logger.info(`Moved corrupted file to ${corruptedFile}`);
        } catch (moveError) {
          logger.warn('Failed to move corrupted file:', moveError);
        }
      }
    }
  }

  /**
   * Save port allocations to storage with atomic writes
   */
  async saveAllocations() {
    try {
      const data = Object.fromEntries(this.allocations);
      const jsonData = JSON.stringify(data, null, 2);
      
      // Create backup before saving
      await this.createBackup();
      
      // Use atomic write: write to temp file then rename
      const tempFile = `${this.storageFile}.tmp`;
      await fs.writeFile(tempFile, jsonData);
      
      // Rename is atomic on most filesystems
      await fs.rename(tempFile, this.storageFile);
      
      logger.info('Port allocations saved atomically');
    } catch (error) {
      logger.error('Failed to save port allocations:', error);
      
      // Try to restore from backup if save failed
      try {
        await this.restoreFromBackup();
        logger.info('Restored port allocations from backup');
      } catch (backupError) {
        logger.error('Failed to restore from backup:', backupError);
      }
      
      throw createErrorResponse('PORT_STORAGE_FAILED', {
        error: error.message,
      });
    }
  }
  
  /**
   * Create backup of current port allocations
   */
  async createBackup() {
    try {
      const backupFile = `${this.storageFile}.backup`;
      
      // Check if main file exists before backing up
      try {
        await fs.access(this.storageFile);
        await fs.copyFile(this.storageFile, backupFile);
        logger.debug('Created port allocations backup');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Main file doesn't exist, nothing to backup
      }
    } catch (error) {
      logger.warn('Failed to create backup:', error);
      // Don't fail the save operation if backup fails
    }
  }
  
  /**
   * Restore port allocations from backup
   */
  async restoreFromBackup() {
    const backupFile = `${this.storageFile}.backup`;
    
    try {
      await fs.access(backupFile);
      await fs.copyFile(backupFile, this.storageFile);
      await this.loadAllocations();
      logger.info('Restored port allocations from backup');
    } catch (error) {
      throw new Error(`No backup available: ${error.message}`);
    }
  }
  
  /**
   * Validate port allocations data structure
   */
  validateAllocations(data) {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    for (const [workspaceId, port] of Object.entries(data)) {
      if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
        return false;
      }
      if (!Number.isInteger(port) || port < this.startPort || port > this.endPort) {
        return false;
      }
    }
    
    return true;
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