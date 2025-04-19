import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { SERVER_NAME, SERVER_VERSION } from "./config";
import { McpProvider } from "./store/schema";
import { isStdioConfig, isSSEConfig } from "./store/schema";

function getProviderClientTransport(mcpConfig: McpProvider) {
  if (isStdioConfig(mcpConfig)) {
    return new StdioClientTransport(mcpConfig.providerParameters);
  }
  if (isSSEConfig(mcpConfig)) {
    return new SSEClientTransport(new URL(mcpConfig.providerParameters.url));
  }
  throw new Error(`Unsupported provider type: ${mcpConfig.type}`);
}

async function connectProviderClient(
  transport: StdioClientTransport | SSEClientTransport
) {
  const client = new McpClient({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  await client.connect(transport);

  return client;
}

export { connectProviderClient, getProviderClientTransport };
