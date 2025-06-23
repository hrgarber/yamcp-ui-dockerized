/**
 * Test suite for workspace configuration schema validation
 */

const Ajv = require('ajv');
const schema = require('./workspace-config.schema.json');

describe('Workspace Configuration Schema', () => {
  let ajv;
  let validate;
  
  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    validate = ajv.compile(schema);
  });
  
  describe('Valid Configurations', () => {
    test('should accept minimal valid configuration', () => {
      const config = {
        workspace: {
          name: 'test-workspace',
          servers: [
            {
              name: 'github',
              command: 'mcp-server-github'
            }
          ]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should accept configuration with all optional fields', () => {
      const config = {
        workspace: {
          name: 'full-config',
          description: 'A workspace with all optional fields',
          servers: [
            {
              name: 'github',
              command: 'mcp-server-github',
              args: ['--token', '${GITHUB_TOKEN}', '--org', 'myorg'],
              env: {
                LOG_LEVEL: 'debug',
                API_URL: 'https://api.github.com'
              },
              retryPolicy: {
                maxAttempts: 5,
                backoffMs: 2000,
                maxBackoffMs: 60000
              },
              timeout: 45000
            }
          ],
          metadata: {
            owner: 'team-platform',
            environment: 'production',
            customField: 'any-value'
          }
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should accept multiple servers', () => {
      const config = {
        workspace: {
          name: 'multi-server',
          servers: [
            { name: 'github', command: 'mcp-server-github' },
            { name: 'slack', command: 'mcp-server-slack' },
            { name: 'jira', command: 'mcp-server-jira' }
          ]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should accept environment variable substitution in args', () => {
      const config = {
        workspace: {
          name: 'env-vars',
          servers: [
            {
              name: 'database',
              command: 'mcp-server-postgres',
              args: ['--connection-string', '${DATABASE_URL}', '--pool-size', '${DB_POOL_SIZE}']
            }
          ]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
  });
  
  describe('Workspace Name Validation', () => {
    test('should reject empty workspace name', () => {
      const config = {
        workspace: {
          name: '',
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/name',
          keyword: 'minLength'
        })
      );
    });
    
    test('should reject workspace name with uppercase letters', () => {
      const config = {
        workspace: {
          name: 'TestWorkspace',
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/name',
          keyword: 'pattern'
        })
      );
    });
    
    test('should reject workspace name with underscores', () => {
      const config = {
        workspace: {
          name: 'test_workspace',
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject workspace name starting with hyphen', () => {
      const config = {
        workspace: {
          name: '-test-workspace',
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject workspace name ending with hyphen', () => {
      const config = {
        workspace: {
          name: 'test-workspace-',
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject workspace name exceeding 63 characters', () => {
      const config = {
        workspace: {
          name: 'a'.repeat(64),
          servers: [{ name: 'test', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/name',
          keyword: 'maxLength'
        })
      );
    });
  });
  
  describe('Server Configuration Validation', () => {
    test('should reject empty servers array', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: []
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/servers',
          keyword: 'minItems'
        })
      );
    });
    
    test('should reject more than 10 servers', () => {
      const servers = Array(11).fill(null).map((_, i) => ({
        name: `server${i}`,
        command: 'test-command'
      }));
      
      const config = {
        workspace: {
          name: 'test',
          servers
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/servers',
          keyword: 'maxItems'
        })
      );
    });
    
    test('should reject server without name', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [
            { command: 'mcp-server-github' }
          ]
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/servers/0',
          keyword: 'required',
          params: { missingProperty: 'name' }
        })
      );
    });
    
    test('should reject server without command', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [
            { name: 'github' }
          ]
        }
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/workspace/servers/0',
          keyword: 'required',
          params: { missingProperty: 'command' }
        })
      );
    });
    
    test('should reject server name with invalid characters', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [
            { name: 'github_server', command: 'test' }
          ]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject server name exceeding 32 characters', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [
            { name: 'a'.repeat(33), command: 'test' }
          ]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
  });
  
  describe('Retry Policy Validation', () => {
    test('should accept valid retry policy', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            retryPolicy: {
              maxAttempts: 5,
              backoffMs: 1000,
              maxBackoffMs: 30000
            }
          }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should reject negative maxAttempts', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            retryPolicy: { maxAttempts: -1 }
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject maxAttempts exceeding 10', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            retryPolicy: { maxAttempts: 11 }
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject backoffMs below minimum', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            retryPolicy: { backoffMs: 50 }
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject maxBackoffMs exceeding maximum', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            retryPolicy: { maxBackoffMs: 400000 }
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
  });
  
  describe('Timeout Validation', () => {
    test('should accept valid timeout', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            timeout: 60000
          }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should reject timeout below minimum', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            timeout: 500
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
    
    test('should reject timeout exceeding maximum', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            timeout: 400000
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
  });
  
  describe('Environment Variables', () => {
    test('should accept valid environment variables', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            env: {
              LOG_LEVEL: 'debug',
              API_KEY: 'secret123',
              EMPTY_VAR: ''
            }
          }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should reject non-string environment values', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            env: {
              PORT: 3000, // Should be string
              ENABLED: true // Should be string
            }
          }]
        }
      };
      
      expect(validate(config)).toBe(false);
    });
  });
  
  describe('Edge Cases', () => {
    test('should reject missing workspace wrapper', () => {
      const config = {
        name: 'test',
        servers: [{ name: 'github', command: 'test' }]
      };
      
      expect(validate(config)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: { missingProperty: 'workspace' }
        })
      );
    });
    
    test('should accept workspace with single character name', () => {
      const config = {
        workspace: {
          name: 'a',
          servers: [{ name: 'b', command: 'test' }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should accept args with empty array', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            args: []
          }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
    
    test('should accept complex environment variable substitution', () => {
      const config = {
        workspace: {
          name: 'test',
          servers: [{
            name: 'github',
            command: 'test',
            args: [
              '${PROTOCOL}://${HOST}:${PORT}/${PATH}',
              '--config=${CONFIG_PATH}/settings.json',
              '${OPTIONAL_VAR}'
            ]
          }]
        }
      };
      
      expect(validate(config)).toBe(true);
    });
  });
  
  describe('Schema Examples', () => {
    test('should validate all provided examples', () => {
      const examples = schema.examples || [];
      
      examples.forEach((example, index) => {
        const result = validate(example);
        if (!result) {
          console.error(`Example ${index} validation errors:`, validate.errors);
        }
        expect(result).toBe(true);
      });
    });
  });
});

// Helper function to extract validation errors
function getValidationErrors(validate) {
  return validate.errors?.map(err => ({
    path: err.instancePath,
    keyword: err.keyword,
    message: err.message,
    params: err.params
  })) || [];
}