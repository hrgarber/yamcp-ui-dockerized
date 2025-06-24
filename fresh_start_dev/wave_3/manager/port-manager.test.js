import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { PortManager } from './port-manager.js';
import portfinder from 'portfinder';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  }
}));

jest.mock('portfinder');

describe('PortManager', () => {
  let portManager;

  beforeEach(() => {
    jest.clearAllMocks();
    portManager = new PortManager({
      storageFile: './test-ports.json'
    });
  });

  describe('initialize', () => {
    it('should load existing allocations from file', async () => {
      const mockAllocations = {
        'workspace1': 9001,
        'workspace2': 9002,
      };
      fs.readFile.mockResolvedValue(JSON.stringify(mockAllocations));

      await portManager.initialize();

      expect(fs.readFile).toHaveBeenCalledWith('./test-ports.json', 'utf8');
      expect(portManager.allocations.get('workspace1')).toBe(9001);
      expect(portManager.allocations.get('workspace2')).toBe(9002);
    });

    it('should handle missing storage file', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      await portManager.initialize();

      expect(portManager.allocations.size).toBe(0);
    });
  });

  describe('allocatePort', () => {
    beforeEach(async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await portManager.initialize();
    });

    it('should allocate a new port for workspace', async () => {
      portfinder.getPortPromise.mockResolvedValue(9001);
      fs.writeFile.mockResolvedValue();

      const port = await portManager.allocatePort('test-workspace');

      expect(port).toBe(9001);
      expect(portManager.allocations.get('test-workspace')).toBe(9001);
      expect(fs.writeFile).toHaveBeenCalledWith(
        './test-ports.json',
        expect.stringContaining('"test-workspace": 9001')
      );
    });

    it('should reuse existing allocation', async () => {
      portManager.allocations.set('test-workspace', 9005);

      const port = await portManager.allocatePort('test-workspace');

      expect(port).toBe(9005);
      expect(portfinder.getPortPromise).not.toHaveBeenCalled();
    });

    it('should find next available port when some are allocated', async () => {
      portManager.allocations.set('workspace1', 9000);
      portManager.allocations.set('workspace2', 9001);
      
      // Simulate ports 9000 and 9001 being unavailable
      portfinder.getPortPromise
        .mockRejectedValueOnce(new Error('Port in use'))
        .mockRejectedValueOnce(new Error('Port in use'))
        .mockResolvedValueOnce(9002);

      const port = await portManager.allocatePort('test-workspace');

      expect(port).toBe(9002);
    });

    it('should throw error when port range is exhausted', async () => {
      // Fill up all ports
      for (let i = 9000; i <= 9999; i++) {
        portManager.allocations.set(`workspace${i}`, i);
      }

      await expect(portManager.allocatePort('new-workspace'))
        .rejects.toMatchObject({
          error: expect.objectContaining({
            code: 3002 // PORT_RANGE_EXHAUSTED
          })
        });
    });
  });

  describe('releasePort', () => {
    beforeEach(async () => {
      portManager.allocations.set('test-workspace', 9001);
      fs.writeFile.mockResolvedValue();
    });

    it('should release allocated port', async () => {
      await portManager.releasePort('test-workspace');

      expect(portManager.allocations.has('test-workspace')).toBe(false);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle releasing non-existent allocation', async () => {
      await portManager.releasePort('non-existent');

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      portManager.allocations.set('workspace1', 9001);
      portManager.allocations.set('workspace2', 9002);
      portManager.allocations.set('workspace3', 9003);
      fs.writeFile.mockResolvedValue();
    });

    it('should remove allocations for non-existent workspaces', async () => {
      const existingWorkspaces = ['workspace1', 'workspace3'];

      await portManager.cleanup(existingWorkspaces);

      expect(portManager.allocations.has('workspace1')).toBe(true);
      expect(portManager.allocations.has('workspace2')).toBe(false);
      expect(portManager.allocations.has('workspace3')).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('port range', () => {
    it('should use default port range 9000-9999', () => {
      const pm = new PortManager();
      expect(pm.startPort).toBe(9000);
      expect(pm.endPort).toBe(9999);
    });

    it('should allow custom port range', () => {
      const pm = new PortManager({
        startPort: 8000,
        endPort: 8100,
      });
      expect(pm.startPort).toBe(8000);
      expect(pm.endPort).toBe(8100);
    });
  });

  describe('isPortAvailable', () => {
    beforeEach(() => {
      portManager.allocations.set('workspace1', 9001);
    });

    it('should return false for allocated ports', () => {
      expect(portManager.isPortAvailable(9001)).toBe(false);
    });

    it('should return true for unallocated ports in range', () => {
      expect(portManager.isPortAvailable(9002)).toBe(true);
    });

    it('should return false for ports outside range', () => {
      expect(portManager.isPortAvailable(8999)).toBe(false);
      expect(portManager.isPortAvailable(10000)).toBe(false);
    });
  });
});