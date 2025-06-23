/**
 * Main entry point for shared contracts
 * Exports all error codes and helper functions
 */

const errorCodes = require('./error-codes');
const workspaceSchema = require('./workspace-config.schema.json');

module.exports = {
  // Re-export everything from error-codes
  ...errorCodes,
  
  // Export the schema
  workspaceSchema,
  
  // Version info
  VERSION: '1.0.0'
};