import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { SERVER_NAME, SERVER_VERSION } from "./config";
import { McpProvider } from "./store/schema";
import { isStdioConfig, isSSEConfig } from "./store/schema";

function getProviderClientTransport(mcpConfig: McpProvider) {
  if (isStdioConfig(mcpConfig)) {
    const { providerParameters } = mcpConfig;
    // if the args is an empty array, delete it
    if (providerParameters.args && providerParameters.args.length === 0) {
      delete providerParameters.args;
    }
    // if the env is an empty object, delete it
    if (
      providerParameters.env &&
      Object.keys(providerParameters.env).length === 0
    ) {
      delete providerParameters.env;
    }

    // inherit the process PATH to allow provider resolve commands with access to the process PATH
    const env = {
      ...providerParameters?.env,
      ...(process.env.PATH ? { PATH: process.env.PATH } : {}), // Explicitly set PATH to inherit the process PATH
    };

    return new StdioClientTransport({
      ...providerParameters,
      env,
    });
  }
  if (isSSEConfig(mcpConfig)) {
    const { providerParameters } = mcpConfig;
    if (providerParameters.url) {
      return new SSEClientTransport(new URL(providerParameters.url));
    }
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
