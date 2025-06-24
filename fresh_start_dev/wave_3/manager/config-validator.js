import Ajv from 'ajv';
import winston from 'winston';
import { promises as fs } from 'fs';
import path from 'path';
import { createErrorResponse } from '../shared/error-codes.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * ConfigValidator validates workspace configurations against JSON schema
 */
export class ConfigValidator {
  constructor(schema) {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.schema = schema;
    this.validate = schema ? this.ajv.compile(schema) : null;
  }

  /**
   * Load schema from file
   */
  async loadSchema(schemaPath) {
    try {
      logger.info(`Loading schema from ${schemaPath}`);
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validate = this.ajv.compile(this.schema);
      logger.info('Schema loaded successfully');
    } catch (error) {
      logger.error('Failed to load schema:', error);
      throw createErrorResponse('CONFIG_SCHEMA_LOAD_FAILED', {
        path: schemaPath,
        error: error.message,
      });
    }
  }

  /**
   * Validate a workspace configuration
   */
  validateConfig(config) {
    if (!this.validate) {
      throw new Error('No schema loaded');
    }

    const valid = this.validate(config);
    if (!valid) {
      const errors = this.validate.errors;
      logger.error('Configuration validation failed:', errors);
      return {
        valid: false,
        errors: this.formatErrors(errors),
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Format AJV errors for better readability
   */
  formatErrors(errors) {
    return errors.map((error) => ({
      path: error.instancePath,
      message: error.message,
      params: error.params,
    }));
  }

  /**
   * Convert configuration to environment variables
   */
  configToEnv(config) {
    const env = [];
    
    // Add the full config as JSON
    env.push(`WORKSPACE_CONFIG=${JSON.stringify(config)}`);
    
    // Add workspace metadata
    env.push(`WORKSPACE_ID=${config.id}`);
    env.push(`WORKSPACE_NAME=${config.name}`);
    
    // Extract individual server configurations
    if (config.servers) {
      config.servers.forEach((server, index) => {
        env.push(`SERVER_${index}_TYPE=${server.type}`);
        env.push(`SERVER_${index}_URL=${server.url}`);
        
        if (server.token) {
          // Check if token uses environment variable syntax
          if (server.token.match(/^\$\{[A-Z_][A-Z0-9_]*\}$/)) {
            const varName = server.token.slice(2, -1);
            const value = process.env[varName];
            if (!value) {
              throw createErrorResponse('CONFIG_ENV_VAR_UNDEFINED', {
                variable: varName,
                server: index,
              });
            }
            env.push(`SERVER_${index}_TOKEN=${value}`);
          } else {
            env.push(`SERVER_${index}_TOKEN=${server.token}`);
          }
        }
        
        if (server.prefix) {
          env.push(`SERVER_${index}_PREFIX=${server.prefix}`);
        }
        
        if (server.config) {
          env.push(`SERVER_${index}_CONFIG=${JSON.stringify(server.config)}`);
        }
      });
      env.push(`SERVER_COUNT=${config.servers.length}`);
    }
    
    // Add custom environment variables
    if (config.environment) {
      Object.entries(config.environment).forEach(([key, value]) => {
        // Expand environment variables in the value
        const expandedValue = this.expandEnvVars(value);
        env.push(`${key}=${expandedValue}`);
      });
    }

    return env;
  }

  /**
   * Validate server configuration
   */
  validateServer(server) {
    const errors = [];
    
    if (!server.type) {
      errors.push('Server must have a type');
    } else if (!['github', 'gitlab', 'filesystem', 'database', 'custom'].includes(server.type)) {
      errors.push(`Invalid server type: ${server.type}`);
    }
    
    if (!server.url) {
      errors.push('Server must have a URL');
    }
    
    if (server.token && !server.token.match(/^(\$\{[A-Z_][A-Z0-9_]*\}|.+)$/)) {
      errors.push('Invalid token format');
    }
    
    if (server.prefix && !server.prefix.match(/^[a-z][a-z0-9_]*$/)) {
      errors.push('Invalid prefix format (must start with lowercase letter, contain only lowercase letters, numbers, and underscores)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper: Expand environment variables
   */
  expandEnvVars(value) {
    return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw createErrorResponse('CONFIG_ENV_VAR_UNDEFINED', {
          variable: varName,
        });
      }
      return envValue;
    });
  }

  /**
   * Validate and normalize configuration
   */
  validateAndNormalize(config) {
    // First validate against schema
    const schemaValidation = this.validateConfig(config);
    if (!schemaValidation.valid) {
      return schemaValidation;
    }
    
    // Additional business logic validation
    const errors = [];
    
    // Validate each server
    if (config.servers) {
      config.servers.forEach((server, index) => {
        const serverValidation = this.validateServer(server);
        if (!serverValidation.valid) {
          errors.push({
            path: `/servers/${index}`,
            errors: serverValidation.errors,
          });
        }
      });
    }
    
    // Check for duplicate server prefixes
    if (config.servers) {
      const prefixes = config.servers
        .filter(s => s.prefix)
        .map(s => s.prefix);
      const duplicates = prefixes.filter((p, i) => prefixes.indexOf(p) !== i);
      if (duplicates.length > 0) {
        errors.push({
          path: '/servers',
          message: `Duplicate prefixes found: ${duplicates.join(', ')}`,
        });
      }
    }
    
    // Set defaults
    if (!config.resources) {
      config.resources = {};
    }
    if (!config.resources.memory) {
      config.resources.memory = '512m';
    }
    if (!config.resources.cpu) {
      config.resources.cpu = 0.5;
    }
    
    return {
      valid: errors.length === 0,
      errors,
      config: errors.length === 0 ? config : null,
    };
  }
}

export default ConfigValidator;