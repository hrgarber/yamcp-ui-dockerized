import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolRequest,
  GetPromptRequest,
  CallToolResultSchema,
  GetPromptResultSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getProviderClientTransport,
  connectProviderClient,
} from "./providerClient.js";

import {
  addNamespace,
  isNamespacedName,
  parseNamespace,
  type Namespace,
} from "./utility/namespace";

import type { McpProvider } from "./store/schema.js";

class GatewayRouter {
  providers?: Map<Namespace, McpClient>;

  // Connect to MCP providers
  async connect(providersConfig: McpProvider[]) {
    this.providers = new Map();
    // iterate and connect  MCP providers
    const providerPromises = [];
    for (const providerConfig of providersConfig) {
      const transport = getProviderClientTransport(providerConfig);
      const { namespace } = providerConfig;
      const providerPromise = connectProviderClient(transport).then(
        (provider) => ({
          namespace,
          provider,
        })
      );
      providerPromises.push(providerPromise);
    }
    const providers = await Promise.all(providerPromises);
    for (const { namespace, provider } of providers) {
      this.providers.set(namespace, provider);
    }
  }

  // List & Index MCP tools
  async listTools() {
    if (!this.providers) {
      throw new Error("Providers not connected");
    }
    const toolList = [];
    // Iterate over all providers and index their tools
    for (const [namespace, provider] of this.providers.entries()) {
      const capabilities = await provider.getServerCapabilities();
      if (capabilities?.tools) {
        const { tools } = await provider.listTools();

        // transform tool names to include namespace
        const namespaceTools = tools.map((tool) => ({
          ...tool,
          // Serialize tool name to include namespace
          name: addNamespace(namespace, tool.name),
        }));

        toolList.push(...namespaceTools);
      }
    }
    return toolList;
  }

  // List & Index MCP prompts
  async listPrompts() {
    if (!this.providers) {
      throw new Error("Providers not connected");
    }
    const promptList = [];
    // Iterate over all providers and index their prompts
    for (const [namespace, provider] of this.providers.entries()) {
      const capabilities = await provider.getServerCapabilities();
      if (capabilities?.prompts) {
        const { prompts } = await provider.listPrompts();
        const namespacePrompts = prompts.map((prompt) => ({
          ...prompt,
          // Serialize prompt name to include namespace
          name: addNamespace(namespace, prompt.name),
        }));

        promptList.push(...namespacePrompts);
      }
    }
    return promptList;
  }

  async routeToolRequest(request: CallToolRequest) {
    const { name } = request.params;
    if (!isNamespacedName(name)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid tool name. Missing namespace."
      );
    }
    const { namespace, name: toolName } = parseNamespace(name);
    // get the provider for the namespace
    const provider = this.providers?.get(namespace);
    if (!provider) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Provider ${namespace} not found`
      );
    }

    // set the tool name to the tool name without the namespace before routing the request
    request.params.name = toolName;

    // route the request to the provider
    return await provider.request(request, CallToolResultSchema);
  }

  async routePromptRequest(request: GetPromptRequest) {
    const { name } = request.params;
    if (!isNamespacedName(name)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid prompt name. Missing namespace."
      );
    }
    const { namespace, name: promptName } = parseNamespace(name);
    // get the provider for the namespace
    const provider = this.providers?.get(namespace);
    if (!provider) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Provider ${namespace} not found`
      );
    }

    // set the  name to the prompt name without the namespace before routing the request
    request.params.name = promptName;

    // route the request to the provider
    return await provider.request(request, GetPromptResultSchema);
  }

  async start(providersConfig: McpProvider[]) {
    await this.connect(providersConfig);
  }

  async stop() {
    if (this.providers) {
      // close all providers
      await Promise.all(
        Array.from(this.providers.values()).map((provider) => provider.close())
      );
      this.providers = undefined;
    }
  }
}

export { GatewayRouter };
