import cron from 'node-cron';
import winston from 'winston';
import fetch from 'node-fetch';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * HealthMonitor performs regular health checks on workspace containers
 */
export class HealthMonitor {
  constructor(dockerClient, options = {}) {
    this.dockerClient = dockerClient;
    this.checkInterval = parseInt(options.checkInterval || process.env.HEALTH_CHECK_INTERVAL || '30000');
    this.checkTimeout = parseInt(options.checkTimeout || process.env.HEALTH_CHECK_TIMEOUT || '5000');
    this.maxRestartAttempts = parseInt(options.maxRestartAttempts || process.env.MAX_RESTART_ATTEMPTS || '5');
    this.initialBackoff = parseInt(options.initialBackoff || process.env.INITIAL_BACKOFF_MS || '1000');
    this.maxBackoff = parseInt(options.maxBackoff || process.env.MAX_BACKOFF_MS || '60000');
    
    this.workspaces = new Map(); // workspaceId -> { port, restartCount, lastCheck, failureCount, lastRestart }
    this.cronJob = null;
    this.isChecking = false;
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.cronJob) {
      logger.warn('Health monitor already started');
      return;
    }

    // Convert milliseconds to cron expression (every X seconds)
    const seconds = Math.floor(this.checkInterval / 1000);
    const cronExpression = `*/${seconds} * * * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.checkAllWorkspaces();
    });

    logger.info(`Health monitor started with ${seconds}s interval`);
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Health monitor stopped');
    }
  }

  /**
   * Add a workspace to monitor
   */
  addWorkspace(workspaceId, port) {
    this.workspaces.set(workspaceId, {
      port,
      restartCount: 0,
      lastCheck: null,
      status: 'unknown',
      failureCount: 0,
      lastRestart: null,
    });
    logger.info(`Added workspace ${workspaceId} to health monitoring on port ${port}`);
  }

  /**
   * Remove a workspace from monitoring
   */
  removeWorkspace(workspaceId) {
    this.workspaces.delete(workspaceId);
    logger.info(`Removed workspace ${workspaceId} from health monitoring`);
  }

  /**
   * Check health of all workspaces
   */
  async checkAllWorkspaces() {
    if (this.isChecking) {
      logger.debug('Health check already in progress, skipping');
      return;
    }
    
    this.isChecking = true;
    
    try {
      const promises = [];
      
      for (const [workspaceId, info] of this.workspaces) {
        promises.push(this.checkWorkspace(workspaceId, info));
      }

      await Promise.allSettled(promises);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Check health of a single workspace
   */
  async checkWorkspace(workspaceId, info) {
    try {
      const healthy = await this.performHealthCheck(info.port);
      info.lastCheck = new Date();
      
      if (healthy) {
        info.status = 'healthy';
        info.failureCount = 0; // Reset failure count on successful check
        
        // Reset restart count if enough time has passed since last restart
        if (info.lastRestart) {
          const timeSinceRestart = Date.now() - info.lastRestart.getTime();
          if (timeSinceRestart > 300000) { // 5 minutes
            info.restartCount = 0;
            logger.debug(`Reset restart count for workspace ${workspaceId} after stable operation`);
          }
        }
      } else {
        info.status = 'unhealthy';
        info.failureCount++;
        logger.warn(`Workspace ${workspaceId} is unhealthy (failure count: ${info.failureCount})`);
        await this.handleUnhealthyWorkspace(workspaceId, info);
      }
    } catch (error) {
      logger.error(`Health check failed for workspace ${workspaceId}:`, error);
      info.status = 'error';
      info.failureCount++;
      await this.handleUnhealthyWorkspace(workspaceId, info);
    }
  }

  /**
   * Perform HTTP health check
   */
  async performHealthCheck(port) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.checkTimeout);

      const response = await fetch(`http://localhost:${port}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle unhealthy workspace with restart logic
   */
  async handleUnhealthyWorkspace(workspaceId, info) {
    // Only restart after multiple consecutive failures
    if (info.failureCount < 2) {
      logger.debug(`Workspace ${workspaceId} failure count below threshold, waiting for next check`);
      return;
    }
    
    if (info.restartCount >= this.maxRestartAttempts) {
      logger.error(`Workspace ${workspaceId} exceeded max restart attempts (${this.maxRestartAttempts})`);
      info.status = 'failed';
      
      // Emit event or notification about failed workspace
      this.notifyWorkspaceFailed(workspaceId, info);
      return;
    }

    info.restartCount++;
    
    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, max 60s
    const backoff = Math.min(
      this.initialBackoff * Math.pow(2, info.restartCount - 1),
      this.maxBackoff
    );
    
    logger.warn(`Scheduling restart ${info.restartCount}/${this.maxRestartAttempts} for workspace ${workspaceId} in ${backoff}ms`);

    // Schedule restart with backoff
    setTimeout(async () => {
      try {
        logger.info(`Restarting workspace ${workspaceId} (attempt ${info.restartCount}/${this.maxRestartAttempts})`);
        await this.dockerClient.restartWorkspace(workspaceId);
        
        info.lastRestart = new Date();
        info.failureCount = 0; // Reset failure count after restart
        logger.info(`Successfully restarted workspace ${workspaceId}`);
        
        // Perform immediate health check after restart
        setTimeout(() => {
          this.checkWorkspace(workspaceId, info).catch(err => {
            logger.error(`Post-restart health check failed for ${workspaceId}:`, err);
          });
        }, 5000); // Wait 5 seconds for container to stabilize
        
      } catch (error) {
        logger.error(`Failed to restart workspace ${workspaceId}:`, error);
        info.status = 'restart-failed';
        
        // If restart fails, it counts as another failure
        if (error.code === 'DOCKER_CONTAINER_NOT_FOUND') {
          // Container doesn't exist, remove from monitoring
          this.removeWorkspace(workspaceId);
          logger.info(`Removed non-existent workspace ${workspaceId} from monitoring`);
        }
      }
    }, backoff);
  }
  
  /**
   * Notify about failed workspace (for external integrations)
   */
  notifyWorkspaceFailed(workspaceId, info) {
    logger.error(`WORKSPACE FAILED: ${workspaceId}`, {
      workspaceId,
      port: info.port,
      restartCount: info.restartCount,
      failureCount: info.failureCount,
      lastCheck: info.lastCheck,
      lastRestart: info.lastRestart,
    });
    
    // TODO: Emit event or call webhook for external notification
    // this.emit('workspace:failed', { workspaceId, info });
  }

  /**
   * Get health status for all workspaces
   */
  getStatus() {
    const status = {};
    
    for (const [workspaceId, info] of this.workspaces) {
      status[workspaceId] = {
        status: info.status,
        lastCheck: info.lastCheck,
        restartCount: info.restartCount,
        failureCount: info.failureCount,
        lastRestart: info.lastRestart,
        port: info.port,
      };
    }

    return status;
  }

  /**
   * Get health status for a specific workspace
   */
  getWorkspaceStatus(workspaceId) {
    const info = this.workspaces.get(workspaceId);
    if (!info) {
      return null;
    }

    return {
      status: info.status,
      lastCheck: info.lastCheck,
      restartCount: info.restartCount,
      failureCount: info.failureCount,
      lastRestart: info.lastRestart,
      port: info.port,
    };
  }
}

export default HealthMonitor;