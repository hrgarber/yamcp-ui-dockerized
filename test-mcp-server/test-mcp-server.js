#!/usr/bin/env node

// Simple test MCP server that outputs JSON-RPC messages to stdout
// This simulates a basic MCP server for testing the SSE endpoint

console.log('Content-Type: application/vnd.api+json');
console.log('');

// Send initialization message
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      prompts: {},
      resources: {}
    },
    serverInfo: {
      name: "test-mcp-server",
      version: "1.0.0"
    }
  }
};

console.log(JSON.stringify(initMessage));

// Simulate periodic messages
let messageCount = 0;
const sendPeriodicMessage = () => {
  messageCount++;
  const message = {
    jsonrpc: "2.0",
    method: "notifications/message",
    params: {
      level: "info",
      message: `Test message ${messageCount} from MCP server at ${new Date().toISOString()}`
    }
  };
  console.log(JSON.stringify(message));
};

// Send a message every 2 seconds
setInterval(sendPeriodicMessage, 2000);

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Keep the process running
process.stdin.resume();