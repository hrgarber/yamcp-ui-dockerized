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
    this.maxRestartAttempts = parseInt(options.maxRestartAttempts || process.env.MAX_RESTART_ATTEMPTS || '3');
    this.restartBackoff = parseInt(options.restartBackoff || process.env.RESTART_BACKOFF_MS || '5000');
    
    this.workspaces = new Map(); // workspaceId -> { port, restartCount, lastCheck }
    this.cronJob = null;
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
    });
    logger.info(`Added workspace ${workspaceId} to health monitoring`);
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
    const promises = [];
    
    for (const [workspaceId, info] of this.workspaces) {
      promises.push(this.checkWorkspace(workspaceId, info));
    }

    await Promise.allSettled(promises);
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
        info.restartCount = 0; // Reset restart count on successful check
      } else {
        info.status = 'unhealthy';
        await this.handleUnhealthyWorkspace(workspaceId, info);
      }
    } catch (error) {
      logger.error(`Health check failed for workspace ${workspaceId}:`, error);
      info.status = 'error';
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
    if (info.restartCount >= this.maxRestartAttempts) {
      logger.error(`Workspace ${workspaceId} exceeded max restart attempts`);
      info.status = 'failed';
      return;
    }

    info.restartCount++;
    logger.warn(`Attempting restart ${info.restartCount}/${this.maxRestartAttempts} for workspace ${workspaceId}`);

    // Apply exponential backoff
    const backoff = this.restartBackoff * Math.pow(2, info.restartCount - 1);
    await new Promise((resolve) => setTimeout(resolve, backoff));

    try {
      await this.dockerClient.restartWorkspace(workspaceId);
      logger.info(`Successfully restarted workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to restart workspace ${workspaceId}:`, error);
    }
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
      port: info.port,
    };
  }
}

export default HealthMonitor;