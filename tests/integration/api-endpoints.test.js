/**
 * API Endpoints Integration Tests
 * Tests the REST API functionality for managing servers and workspaces
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import Docker from 'dockerode';

const docker = new Docker();
const CONTAINER_NAME = 'yamcp-ui-dev';

describe('API Endpoints Integration', () => {
  let container;

  beforeAll(async () => {
    const containers = await docker.listContainers({ 
      filters: { name: [CONTAINER_NAME] } 
    });
    container = docker.getContainer(containers[0].Id);
  });

  describe('Server Management API', () => {
    test('should add a new server via POST /api/servers', async () => {
      const serverConfig = {
        name: 'test-api-server',
        type: 'stdio',
        command: 'echo',
        args: ['Hello API Test']
      };

      const exec = await container.exec({
        Cmd: [
          'wget', '-q', '-O', '-', 
          '--post-data', JSON.stringify(serverConfig),
          '--header', 'Content-Type: application/json',
          'http://localhost:8765/api/servers'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const response = JSON.parse(output);
      expect(response.success).toBe(true);
      expect(response.message).toContain('test-api-server');
    });

    test('should retrieve servers via GET /api/servers', async () => {
      const exec = await container.exec({
        Cmd: ['wget', '-q', '-O', '-', 'http://localhost:8765/api/servers'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const servers = JSON.parse(output);
      expect(Array.isArray(servers)).toBe(true);
      
      const testServer = servers.find(s => s.name === 'test-api-server');
      expect(testServer).toBeDefined();
      expect(testServer.type).toBe('stdio');
      expect(testServer.command).toBe('echo');
    });

    test('should update server via PUT /api/servers/:id', async () => {
      const updatedConfig = {
        name: 'test-api-server-updated',
        type: 'stdio',
        command: 'echo',
        args: ['Updated message']
      };

      const exec = await container.exec({
        Cmd: [
          'wget', '-q', '-O', '-', 
          '--method', 'PUT',
          '--body-data', JSON.stringify(updatedConfig),
          '--header', 'Content-Type: application/json',
          'http://localhost:8765/api/servers/test-api-server'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const response = JSON.parse(output);
      expect(response.success).toBe(true);
    });
  });

  describe('Workspace Management API', () => {
    test('should add a new workspace via POST /api/workspaces', async () => {
      const workspaceConfig = {
        name: 'test-api-workspace',
        servers: ['test-api-server-updated']
      };

      const exec = await container.exec({
        Cmd: [
          'wget', '-q', '-O', '-',
          '--post-data', JSON.stringify(workspaceConfig),
          '--header', 'Content-Type: application/json',
          'http://localhost:8765/api/workspaces'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const response = JSON.parse(output);
      expect(response.success).toBe(true);
      expect(response.message).toContain('test-api-workspace');
    });

    test('should retrieve workspaces via GET /api/workspaces', async () => {
      const exec = await container.exec({
        Cmd: ['wget', '-q', '-O', '-', 'http://localhost:8765/api/workspaces'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const workspaces = JSON.parse(output);
      expect(Array.isArray(workspaces)).toBe(true);
      
      const testWorkspace = workspaces.find(w => w.name === 'test-api-workspace');
      expect(testWorkspace).toBeDefined();
      expect(testWorkspace.servers).toContain('test-api-server-updated');
    });
  });

  describe('Configuration Persistence', () => {
    test('configuration should persist in JSON files', async () => {
      // Check providers.json
      const providersExec = await container.exec({
        Cmd: ['cat', '/root/.local/share/yamcp-nodejs/providers.json'],
        AttachStdout: true,
        AttachStderr: true
      });

      const providersStream = await providersExec.start();
      const providersOutput = await streamToString(providersStream);
      
      const providers = JSON.parse(providersOutput);
      expect(providers['test-api-server-updated']).toBeDefined();

      // Check workspaces.json
      const workspacesExec = await container.exec({
        Cmd: ['cat', '/root/.local/share/yamcp-nodejs/workspaces.json'],
        AttachStdout: true,
        AttachStderr: true
      });

      const workspacesStream = await workspacesExec.start();
      const workspacesOutput = await streamToString(workspacesStream);
      
      const workspaces = JSON.parse(workspacesOutput);
      expect(workspaces['test-api-workspace']).toBeDefined();
    });
  });
});

// Helper function to convert Docker stream to string
async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', chunk => {
      data += chunk.toString();
    });
    stream.on('end', () => {
      resolve(data);
    });
    stream.on('error', reject);
  });
}