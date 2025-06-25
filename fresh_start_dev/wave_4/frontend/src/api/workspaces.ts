const API_BASE = 'http://localhost:3456/api';

export interface WorkspaceConfig {
  name: string;
  servers: Record<string, {
    command: string;
    args: string[];
  }>;
}

export interface WorkspaceStatus {
  config: WorkspaceConfig;
  status: 'running' | 'starting' | 'unhealthy' | 'stopped';
  port: number;
  url: string;
  health?: {
    status: 'healthy' | 'unhealthy';
    lastCheck: string;
    details: any;
  };
  container?: {
    id: string;
    name: string;
  };
}

export interface WorkspacesResponse {
  workspaces: Record<string, WorkspaceStatus>;
}

export const workspaceApi = {
  list: async (): Promise<WorkspacesResponse> => {
    const response = await fetch(`${API_BASE}/workspaces`);
    if (!response.ok) {
      throw new Error('Failed to fetch workspaces');
    }
    return response.json();
  },

  create: async (name: string, config: WorkspaceConfig) => {
    const response = await fetch(`${API_BASE}/workspaces/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) {
      throw new Error('Failed to create workspace');
    }
    return response.json();
  },

  delete: async (name: string) => {
    const response = await fetch(`${API_BASE}/workspaces/${name}`, { 
      method: 'DELETE' 
    });
    if (!response.ok) {
      throw new Error('Failed to delete workspace');
    }
    return response.json();
  }
};