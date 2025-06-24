import { WorkspaceManagerService, WorkspaceConfig, WorkspaceStatus, PublishResult } from './workspace-manager';

// Mock fetch globally
global.fetch = jest.fn();

describe('WorkspaceManagerService', () => {
  let service: WorkspaceManagerService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new WorkspaceManagerService('/api/workspaces');
    jest.clearAllMocks();
  });

  describe('publish', () => {
    it('should publish a workspace successfully', async () => {
      const config: WorkspaceConfig = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            name: 'server1',
            type: 'filesystem',
            config: { path: '/tmp' },
          },
        ],
      };

      const mockResult: PublishResult = {
        id: 'test-workspace',
        port: 8080,
        message: 'Workspace published successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const result = await service.publish(config);

      expect(mockFetch).toHaveBeenCalledWith('/api/workspaces/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw error when publish fails', async () => {
      const config: WorkspaceConfig = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid configuration' }),
      } as Response);

      await expect(service.publish(config)).rejects.toThrow('Invalid configuration');
    });
  });

  describe('getStatus', () => {
    it('should get workspace status successfully', async () => {
      const mockStatus: WorkspaceStatus = {
        id: 'test-workspace',
        state: 'running',
        port: 8080,
        url: 'http://localhost:8080',
        lastChecked: new Date().toISOString(),
        config: {
          id: 'test-workspace',
          name: 'Test Workspace',
          servers: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      } as Response);

      const result = await service.getStatus('test-workspace');

      expect(mockFetch).toHaveBeenCalledWith('/api/workspaces/test-workspace/status');
      expect(result).toEqual(mockStatus);
    });

    it('should throw error when get status fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Workspace not found' }),
      } as Response);

      await expect(service.getStatus('non-existent')).rejects.toThrow('Workspace not found');
    });
  });

  describe('getAllStatuses', () => {
    it('should get all workspace statuses successfully', async () => {
      const mockStatuses: WorkspaceStatus[] = [
        {
          id: 'workspace1',
          state: 'running',
          port: 8080,
          lastChecked: new Date().toISOString(),
          config: {
            id: 'workspace1',
            name: 'Workspace 1',
            servers: [],
          },
        },
        {
          id: 'workspace2',
          state: 'stopped',
          lastChecked: new Date().toISOString(),
          config: {
            id: 'workspace2',
            name: 'Workspace 2',
            servers: [],
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatuses,
      } as Response);

      const result = await service.getAllStatuses();

      expect(mockFetch).toHaveBeenCalledWith('/api/workspaces/status');
      expect(result).toEqual(mockStatuses);
    });
  });

  describe('delete', () => {
    it('should delete workspace successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await service.delete('test-workspace');

      expect(mockFetch).toHaveBeenCalledWith('/api/workspaces/test-workspace', {
        method: 'DELETE',
      });
    });

    it('should throw error when delete fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Cannot delete running workspace' }),
      } as Response);

      await expect(service.delete('test-workspace')).rejects.toThrow('Cannot delete running workspace');
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration successfully', async () => {
      const config: WorkspaceConfig = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      } as Response);

      const result = await service.validateConfig(config);

      expect(mockFetch).toHaveBeenCalledWith('/api/workspaces/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      expect(result).toEqual({ valid: true });
    });

    it('should return validation errors', async () => {
      const config: WorkspaceConfig = {
        id: '',
        name: '',
        servers: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: false,
          errors: ['ID is required', 'Name is required'],
        }),
      } as Response);

      const result = await service.validateConfig(config);

      expect(result).toEqual({
        valid: false,
        errors: ['ID is required', 'Name is required'],
      });
    });
  });
});