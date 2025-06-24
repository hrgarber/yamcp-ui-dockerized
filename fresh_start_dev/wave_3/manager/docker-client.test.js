import { jest } from '@jest/globals';
import { DockerClient } from './docker-client.js';

describe('DockerClient', () => {
  let dockerClient;
  let mockDocker;

  beforeEach(() => {
    // Mock the Docker API
    mockDocker = {
      ping: jest.fn().mockResolvedValue(true),
      listNetworks: jest.fn().mockResolvedValue([]),
      createNetwork: jest.fn().mockResolvedValue({}),
      listContainers: jest.fn().mockResolvedValue([]),
      createContainer: jest.fn().mockReturnValue({
        start: jest.fn().mockResolvedValue({}),
        id: 'test-container-id'
      }),
      getContainer: jest.fn(),
    };

    dockerClient = new DockerClient();
    dockerClient.docker = mockDocker;
  });

  describe('initialize', () => {
    it('should ping Docker daemon', async () => {
      await dockerClient.initialize();
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should ensure network exists', async () => {
      await dockerClient.initialize();
      expect(mockDocker.listNetworks).toHaveBeenCalled();
      expect(mockDocker.createNetwork).toHaveBeenCalledWith({
        Name: 'mcp-network',
        Driver: 'bridge',
        Labels: {
          'mcp.workspace': 'true',
        },
      });
    });

    it('should not create network if it already exists', async () => {
      mockDocker.listNetworks.mockResolvedValue([
        { Name: 'mcp-network' }
      ]);
      await dockerClient.initialize();
      expect(mockDocker.createNetwork).not.toHaveBeenCalled();
    });
  });

  describe('createWorkspace', () => {
    const testConfig = {
      id: 'test-workspace',
      name: 'Test Workspace',
      servers: [
        {
          type: 'github',
          url: 'https://api.github.com',
          token: 'test-token',
        }
      ],
      resources: {
        memory: '512m',
        cpu: 0.5
      }
    };

    it('should create and start a workspace container', async () => {
      mockDocker.getContainer.mockImplementation(() => {
        throw { statusCode: 404 };
      });

      const result = await dockerClient.createWorkspace('test-workspace', testConfig, 9001);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'mcp-workspace-test-workspace',
          Image: 'mcp-workspace:latest',
          Env: expect.arrayContaining([
            expect.stringContaining('WORKSPACE_CONFIG='),
            'WORKSPACE_ID=test-workspace',
            'WORKSPACE_NAME=Test Workspace',
          ]),
          HostConfig: expect.objectContaining({
            PortBindings: {
              '8080/tcp': [{ HostPort: '9001' }]
            },
            Memory: 512 * 1024 * 1024,
            CpuQuota: 50000,
          }),
        })
      );

      expect(result).toEqual({
        id: 'test-container-id',
        name: 'mcp-workspace-test-workspace',
        port: 9001,
        status: 'running',
      });
    });

    it('should throw error if workspace already exists', async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: jest.fn().mockResolvedValue({})
      });

      await expect(dockerClient.createWorkspace('test-workspace', testConfig, 9001))
        .rejects.toMatchObject({
          error: expect.objectContaining({
            code: 4002
          })
        });
    });
  });

  describe('listWorkspaces', () => {
    it('should list all workspace containers', async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Id: 'container1',
          Names: ['/mcp-workspace-test1'],
          State: 'running',
          Created: 1234567890,
          Labels: {
            'mcp.workspace.port': '9001',
            'mcp.workspace.name': 'Test 1',
          }
        },
        {
          Id: 'container2',
          Names: ['/mcp-workspace-test2'],
          State: 'stopped',
          Created: 1234567891,
          Labels: {
            'mcp.workspace.port': '9002',
            'mcp.workspace.name': 'Test 2',
          }
        },
        {
          Id: 'container3',
          Names: ['/other-container'],
          State: 'running',
          Created: 1234567892,
          Labels: {}
        }
      ]);

      const result = await dockerClient.listWorkspaces();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'test1',
        containerId: 'container1',
        status: 'running',
        running: true,
        port: '9001',
        name: 'Test 1',
        created: expect.any(String),
      });
      expect(result[1]).toEqual({
        id: 'test2',
        containerId: 'container2',
        status: 'stopped',
        running: false,
        port: '9002',
        name: 'Test 2',
        created: expect.any(String),
      });
    });
  });

  describe('helper methods', () => {
    describe('parseMemoryLimit', () => {
      it('should parse memory in MB', () => {
        expect(dockerClient.parseMemoryLimit('512m')).toBe(512 * 1024 * 1024);
      });

      it('should parse memory in GB', () => {
        expect(dockerClient.parseMemoryLimit('2g')).toBe(2 * 1024 * 1024 * 1024);
      });

      it('should throw error for invalid format', () => {
        expect(() => dockerClient.parseMemoryLimit('invalid')).toThrow();
      });
    });

    describe('formatMemoryLimit', () => {
      it('should format bytes to MB', () => {
        expect(dockerClient.formatMemoryLimit(512 * 1024 * 1024)).toBe('512m');
      });

      it('should format bytes to GB', () => {
        expect(dockerClient.formatMemoryLimit(2 * 1024 * 1024 * 1024)).toBe('2g');
      });
    });
  });
});