import { jest } from '@jest/globals';
import request from 'supertest';
import app from './index.js';

describe('Manager Service', () => {
  afterAll(() => {
    // Close any open handles
    if (app && app.close) {
      app.close();
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('Workspace Endpoints', () => {
    it('should return 501 for POST /api/workspaces', async () => {
      const response = await request(app)
        .post('/api/workspaces')
        .send({ name: 'test-workspace' });
      
      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', 'Not implemented');
    });

    it('should return 501 for GET /api/workspaces', async () => {
      const response = await request(app).get('/api/workspaces');
      
      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', 'Not implemented');
    });

    it('should return 501 for GET /api/workspaces/:id', async () => {
      const response = await request(app).get('/api/workspaces/test-id');
      
      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', 'Not implemented');
    });

    it('should return 501 for PUT /api/workspaces/:id', async () => {
      const response = await request(app)
        .put('/api/workspaces/test-id')
        .send({ name: 'updated-workspace' });
      
      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', 'Not implemented');
    });

    it('should return 501 for DELETE /api/workspaces/:id', async () => {
      const response = await request(app).delete('/api/workspaces/test-id');
      
      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('error', 'Not implemented');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers).toHaveProperty('x-helmet-csp');
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
});