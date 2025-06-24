import { jest } from '@jest/globals';
import { ConfigValidator } from './config-validator.js';
import workspaceSchema from '../shared/workspace-config.schema.json' assert { type: 'json' };

describe('ConfigValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ConfigValidator(workspaceSchema);
  });

  describe('validateConfig', () => {
    it('should validate a valid configuration', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
            token: 'test-token',
          }
        ]
      };

      const result = validator.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject configuration missing required fields', () => {
      const config = {
        name: 'Test Workspace',
        // Missing id and servers
      };

      const result = validator.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: '',
          message: expect.stringContaining('required property'),
        })
      );
    });

    it('should reject invalid workspace ID', () => {
      const config = {
        id: 'Invalid ID!', // Contains invalid characters
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
          }
        ]
      };

      const result = validator.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: '/id',
        })
      );
    });

    it('should reject invalid server type', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'invalid-type',
            url: 'https://example.com',
          }
        ]
      };

      const result = validator.validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should accept environment variable tokens', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
            token: '${GITHUB_TOKEN}',
          }
        ]
      };

      const result = validator.validateConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('configToEnv', () => {
    beforeEach(() => {
      process.env.TEST_TOKEN = 'secret-token';
    });

    afterEach(() => {
      delete process.env.TEST_TOKEN;
    });

    it('should convert configuration to environment variables', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
            token: 'test-token',
            prefix: 'gh',
          },
          {
            type: 'gitlab',
            url: 'https://gitlab.com',
            token: '${TEST_TOKEN}',
          }
        ],
        environment: {
          CUSTOM_VAR: 'custom-value',
        }
      };

      const env = validator.configToEnv(config);

      expect(env).toContain(`WORKSPACE_CONFIG=${JSON.stringify(config)}`);
      expect(env).toContain('WORKSPACE_ID=test-workspace');
      expect(env).toContain('WORKSPACE_NAME=Test Workspace');
      expect(env).toContain('SERVER_0_TYPE=github');
      expect(env).toContain('SERVER_0_URL=https://api.github.com');
      expect(env).toContain('SERVER_0_TOKEN=test-token');
      expect(env).toContain('SERVER_0_PREFIX=gh');
      expect(env).toContain('SERVER_1_TYPE=gitlab');
      expect(env).toContain('SERVER_1_URL=https://gitlab.com');
      expect(env).toContain('SERVER_1_TOKEN=secret-token');
      expect(env).toContain('SERVER_COUNT=2');
      expect(env).toContain('CUSTOM_VAR=custom-value');
    });

    it('should throw error for undefined environment variables', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
            token: '${UNDEFINED_VAR}',
          }
        ]
      };

      expect(() => validator.configToEnv(config)).toThrow();
    });
  });

  describe('validateServer', () => {
    it('should validate a valid server configuration', () => {
      const server = {
        type: 'github',
        url: 'https://api.github.com',
        token: 'test-token',
        prefix: 'gh',
      };

      const result = validator.validateServer(server);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject server without type', () => {
      const server = {
        url: 'https://api.github.com',
      };

      const result = validator.validateServer(server);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server must have a type');
    });

    it('should reject invalid prefix format', () => {
      const server = {
        type: 'github',
        url: 'https://api.github.com',
        prefix: '123invalid', // Must start with lowercase letter
      };

      const result = validator.validateServer(server);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Invalid prefix format')
      );
    });
  });

  describe('validateAndNormalize', () => {
    it('should add default resource limits', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
          }
        ]
      };

      const result = validator.validateAndNormalize(config);
      expect(result.valid).toBe(true);
      expect(result.config.resources).toEqual({
        memory: '512m',
        cpu: 0.5,
      });
    });

    it('should detect duplicate server prefixes', () => {
      const config = {
        id: 'test-workspace',
        name: 'Test Workspace',
        servers: [
          {
            type: 'github',
            url: 'https://api.github.com',
            prefix: 'gh',
          },
          {
            type: 'gitlab',
            url: 'https://gitlab.com',
            prefix: 'gh', // Duplicate prefix
          }
        ]
      };

      const result = validator.validateAndNormalize(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: '/servers',
          message: expect.stringContaining('Duplicate prefixes found: gh'),
        })
      );
    });
  });
});