// Test setup and global configuration
import { beforeAll, afterAll } from '@jest/globals';

// Global test timeout for Docker operations
jest.setTimeout(60000);

// Global setup
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});