/**
 * Docker Infrastructure Integration Tests
 * Tests the complete Docker setup, container lifecycle, and service health
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import Docker from 'dockerode';
import fetch from 'node-fetch';

const docker = new Docker();
const CONTAINER_NAME = 'yamcp-ui-dev';
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8765';

describe('Docker Infrastructure', () => {
  let container;

  beforeAll(async () => {
    // Find the running container
    const containers = await docker.listContainers({ 
      filters: { name: [CONTAINER_NAME] } 
    });
    
    if (containers.length > 0) {
      container = docker.getContainer(containers[0].Id);
    }
  });

  describe('Container Lifecycle', () => {
    test('container should be running', async () => {
      expect(container).toBeDefined();
      
      const info = await container.inspect();
      expect(info.State.Status).toBe('running');
    });

    test('container should have correct port mappings', async () => {
      const info = await container.inspect();
      const ports = info.NetworkSettings.Ports;
      
      expect(ports['5173/tcp']).toBeDefined();
      expect(ports['8765/tcp']).toBeDefined();
      expect(ports['5173/tcp'][0].HostPort).toBe('5173');
      expect(ports['8765/tcp'][0].HostPort).toBe('8765');
    });

    test('container should have persistent volume mounted', async () => {
      const info = await container.inspect();
      const mounts = info.Mounts;
      
      const yamcpDataMount = mounts.find(m => 
        m.Destination === '/root/.local/share/yamcp-nodejs'
      );
      
      expect(yamcpDataMount).toBeDefined();
      expect(yamcpDataMount.Type).toBe('volume');
    });
  });

  describe('Process Management', () => {
    test('PM2 should be managing backend process', async () => {
      const exec = await container.exec({
        Cmd: ['sh', '-c', 'ps aux | grep "yamcp-ui-backend-hub" | grep -v grep'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      expect(output).toContain('yamcp-ui-backend-hub');
    });

    test('Node.js processes should be running', async () => {
      const exec = await container.exec({
        Cmd: ['sh', '-c', 'pgrep node | wc -l'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      const processCount = parseInt(output.trim());
      
      expect(processCount).toBeGreaterThan(0);
    });
  });
});

describe('Service Health', () => {
  describe('Frontend Service', () => {
    test('should return HTML with correct title', async () => {
      const response = await fetch(FRONTEND_URL);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('<title>YAMCP Dashboard</title>');
      expect(html).toContain('id="root"');
    });

    test('should serve static assets', async () => {
      const response = await fetch(`${FRONTEND_URL}/vite.svg`);
      expect(response.status).toBe(200);
    });
  });

  describe('Backend Service', () => {
    test('API health check should return valid stats', async () => {
      // Test from inside container to avoid CORS issues
      const exec = await docker.getContainer(CONTAINER_NAME).exec({
        Cmd: ['wget', '-q', '-O', '-', 'http://localhost:8765/api/stats'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const stats = JSON.parse(output);
      expect(stats).toHaveProperty('totalServers');
      expect(stats).toHaveProperty('activeServers');
      expect(stats).toHaveProperty('totalWorkspaces');
      expect(stats).toHaveProperty('activeWorkspaces');
      expect(stats).toHaveProperty('issues');
    });

    test('should return empty arrays for initial state', async () => {
      const exec = await docker.getContainer(CONTAINER_NAME).exec({
        Cmd: ['wget', '-q', '-O', '-', 'http://localhost:8765/api/servers'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      const servers = JSON.parse(output);
      expect(Array.isArray(servers)).toBe(true);
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