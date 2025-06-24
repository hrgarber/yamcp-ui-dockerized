/**
 * API client for workspace manager service
 * Handles communication with the Node.js manager service for workspace lifecycle operations
 */

export interface WorkspaceConfig {
  id: string;
  name: string;
  servers: Array<{
    name: string;
    type: string;
    config: Record<string, any>;
  }>;
}

export interface WorkspaceStatus {
  id: string;
  state: 'starting' | 'running' | 'error' | 'stopped';
  port?: number;
  url?: string;
  error?: string;
  lastChecked: string;
  config: WorkspaceConfig;
}

export interface PublishResult {
  id: string;
  port: number;
  message: string;
}

export class WorkspaceManagerService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/workspaces') {
    this.baseUrl = baseUrl;
  }

  /**
   * Publish a new workspace or update an existing one
   */
  async publish(config: WorkspaceConfig): Promise<PublishResult> {
    const response = await fetch(`${this.baseUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to publish workspace');
    }

    return response.json();
  }

  /**
   * Get the current status of a workspace
   */
  async getStatus(workspaceId: string): Promise<WorkspaceStatus> {
    const response = await fetch(`${this.baseUrl}/${workspaceId}/status`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get workspace status');
    }

    return response.json();
  }

  /**
   * Get status of all workspaces
   */
  async getAllStatuses(): Promise<WorkspaceStatus[]> {
    const response = await fetch(`${this.baseUrl}/status`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get workspaces status');
    }

    return response.json();
  }

  /**
   * Delete a workspace
   */
  async delete(workspaceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${workspaceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete workspace');
    }
  }

  /**
   * Validate a workspace configuration
   */
  async validateConfig(config: WorkspaceConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await fetch(`${this.baseUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate configuration');
    }

    return response.json();
  }
}

// Default instance
export const workspaceManager = new WorkspaceManagerService();