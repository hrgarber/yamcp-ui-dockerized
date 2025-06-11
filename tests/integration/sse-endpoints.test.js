/**
 * SSE Endpoints Integration Tests
 * Tests Server-Sent Events functionality for MCP workspace streaming
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import Docker from 'dockerode';
import EventSource from 'eventsource';

const docker = new Docker();
const CONTAINER_NAME = 'yamcp-ui-dev';
const SSE_BASE_URL = 'http://localhost:8765/mcp';

describe('SSE Endpoints Integration', () => {
  let container;

  beforeAll(async () => {
    const containers = await docker.listContainers({ 
      filters: { name: [CONTAINER_NAME] } 
    });
    container = docker.getContainer(containers[0].Id);

    // Ensure we have a test workspace ready
    const workspaceConfig = {
      name: 'sse-test-workspace',
      servers: ['sse-test-server']
    };

    const serverConfig = {
      name: 'sse-test-server',
      type: 'stdio',
      command: 'echo',
      args: ['SSE Test Output']
    };

    // Add server
    await container.exec({
      Cmd: [
        'wget', '-q', '-O', '-',
        '--post-data', JSON.stringify(serverConfig),
        '--header', 'Content-Type: application/json',
        'http://localhost:8765/api/servers'
      ],
      AttachStdout: true,
      AttachStderr: true
    }).then(exec => exec.start());

    // Add workspace
    await container.exec({
      Cmd: [
        'wget', '-q', '-O', '-',
        '--post-data', JSON.stringify(workspaceConfig),
        '--header', 'Content-Type: application/json',
        'http://localhost:8765/api/workspaces'
      ],
      AttachStdout: true,
      AttachStderr: true
    }).then(exec => exec.start());
  });

  describe('SSE Connection and Headers', () => {
    test('should return correct SSE headers', async () => {
      // Test headers using curl from inside container
      const exec = await container.exec({
        Cmd: [
          'sh', '-c', 
          'timeout 2 wget -q -S -O /dev/null http://localhost:8765/mcp/sse-test-workspace 2>&1 | grep -E "(Content-Type|Cache-Control|Connection)"'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      expect(output).toContain('Content-Type: text/event-stream');
      expect(output).toContain('Cache-Control: no-cache');
      expect(output).toContain('Connection: keep-alive');
    });

    test('should handle non-existent workspace gracefully', async () => {
      const exec = await container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 3 wget -q -O - http://localhost:8765/mcp/nonexistent-workspace 2>/dev/null || echo "connection_failed"'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      // Should either get an error event or connection failure
      expect(output).toMatch(/(not found|connection_failed|error)/i);
    });
  });

  describe('Process Execution and Streaming', () => {
    test('should stream process output via SSE', async () => {
      const exec = await container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 5 wget -q -O - http://localhost:8765/mcp/sse-test-workspace 2>/dev/null'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      // Should contain SSE event structure
      expect(output).toContain('event: info');
      expect(output).toContain('data:');
      expect(output).toContain('Attempting to start workspace');
      
      // Should contain the actual command output
      expect(output).toContain('SSE Test Output');
    });

    test('should send startup and shutdown events', async () => {
      const exec = await container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 5 wget -q -O - http://localhost:8765/mcp/sse-test-workspace 2>/dev/null'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const output = await streamToString(stream);
      
      // Should have startup event
      expect(output).toContain('event: info');
      expect(output).toContain('Attempting to start workspace');
      
      // Should have close event (since echo command exits quickly)
      expect(output).toContain('event: close');
      expect(output).toContain('connection closed');
    });
  });

  describe('Process Management', () => {
    test('should clean up processes when connection closes', async () => {
      // Get initial process count
      const initialExec = await container.exec({
        Cmd: ['sh', '-c', 'pgrep echo | wc -l'],
        AttachStdout: true,
        AttachStderr: true
      });
      const initialStream = await initialExec.start();
      const initialCount = parseInt(await streamToString(initialStream));

      // Start SSE connection in background (will timeout and close)
      const sseExec = await container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 2 wget -q -O - http://localhost:8765/mcp/sse-test-workspace > /dev/null 2>&1 &'
        ],
        AttachStdout: true,
        AttachStderr: true
      });
      await sseExec.start();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check final process count
      const finalExec = await container.exec({
        Cmd: ['sh', '-c', 'pgrep echo | wc -l'],
        AttachStdout: true,
        AttachStderr: true
      });
      const finalStream = await finalExec.start();
      const finalCount = parseInt(await streamToString(finalStream));

      // Should not have significantly more processes (allowing for timing)
      expect(finalCount).toBeLessThanOrEqual(initialCount + 1);
    });
  });

  describe('Concurrent Connections', () => {
    test('should handle multiple SSE connections to same workspace', async () => {
      // Start two connections simultaneously
      const exec1 = container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 3 wget -q -O - http://localhost:8765/mcp/sse-test-workspace 2>/dev/null'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const exec2 = container.exec({
        Cmd: [
          'sh', '-c',
          'timeout 3 wget -q -O - http://localhost:8765/mcp/sse-test-workspace 2>/dev/null'
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      const [stream1, stream2] = await Promise.all([
        exec1.then(e => e.start()),
        exec2.then(e => e.start())
      ]);

      const [output1, output2] = await Promise.all([
        streamToString(stream1),
        streamToString(stream2)
      ]);

      // Both should get valid SSE output
      expect(output1).toContain('event: info');
      expect(output2).toContain('event: info');
      
      // Second connection should indicate restart due to new connection
      expect(output2).toContain('Restarting workspace');
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