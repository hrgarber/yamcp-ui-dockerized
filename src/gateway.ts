import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsResult,
  CallToolResult,
  ListPromptsResult,
  GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpProvider } from "./store/schema";
import { GatewayServer } from "./gatewayServer.js";
import { GatewayRouter } from "./gatewayRouter.js";
import { Logger } from "./utility/logger.js";

class McpGateway {
  private server: GatewayServer;
  private router: GatewayRouter;
  private isStarted = false;
  private _logger?: Logger;

  constructor(router: GatewayRouter, server: GatewayServer, logger?: Logger) {
    this.server = server;
    this.router = router;
    this._logger = logger;
  }

  private _toolHandlersInitialized = false;
  private setToolRequestHandler() {
    const mcpServer = this.server.mcpServer;

    if (this._toolHandlersInitialized) {
      return;
    }

    if (!mcpServer) {
      throw new Error("GatewayServer not started");
    }

    // assert the handlers are not already set
    mcpServer.assertCanSetRequestHandler(
      ListToolsRequestSchema.shape.method.value
    );
    mcpServer.assertCanSetRequestHandler(
      CallToolRequestSchema.shape.method.value
    );

    mcpServer.registerCapabilities({
      tools: {
        listChanged: true,
      },
    });

    // set list tools handler
    mcpServer.setRequestHandler(
      ListToolsRequestSchema,
      async (request): Promise<ListToolsResult> => {
        this._logger?.logMessage({
          level: "info",
          data: request,
        });
        const tools = await this.router.listTools();
        return {
          tools,
        };
      }
    );

    // set call tool handler
    mcpServer.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<CallToolResult> => {
        this._logger?.logMessage({
          level: "info",
          data: request,
        });
        return await this.router.routeToolRequest(request);
      }
    );
  }

  private _promptHandlersInitialized = false;
  private setPromptRequestHandler() {
    const mcpServer = this.server.mcpServer;

    if (this._promptHandlersInitialized) {
      return;
    }

    if (!mcpServer) {
      throw new Error("GatewayServer not started");
    }

    // assert the handlers are not already set
    mcpServer.assertCanSetRequestHandler(
      ListPromptsRequestSchema.shape.method.value
    );

    mcpServer.registerCapabilities({
      prompts: {
        listChanged: true,
      },
    });

    // set list prompts handler
    mcpServer.setRequestHandler(
      ListPromptsRequestSchema,
      async (request): Promise<ListPromptsResult> => {
        this._logger?.logMessage({
          level: "info",
          data: request,
        });
        return {
          prompts: await this.router.listPrompts(),
        };
      }
    );

    // set get prompt handler
    mcpServer.setRequestHandler(
      GetPromptRequestSchema,
      async (request): Promise<GetPromptResult> => {
        this._logger?.logMessage({
          level: "info",
          data: request,
        });
        return await this.router.routePromptRequest(request);
      }
    );
  }

  // TODO: implement support for resources
  /*
    private _resourceHandlersInitialized = false;
    private setResourceRequestHandler() {} // TODO: implement support for resources
    */

  async start(providersConfig: McpProvider[]) {
    // first set the handlers. This should be done before starting the server and router
    this.setToolRequestHandler();
    this.setPromptRequestHandler();
    this._logger?.logMessage({
      level: "info",
      data: "MCP Gateway started...",
    });

    // start the gateway server and router
    await this.router.start(providersConfig);
    await this.server.start();

    this._logger?.logMessage({
      level: "info",
      data: "Listening for client connections on stdio",
    });

    this.isStarted = true;
  }

  async stop() {
    if (!this.isStarted) {
      return;
    }
    // send a logging message to the client
    this._logger?.logMessage({
      level: "info",
      data: "Shutting down gateway...",
    });

    // stop the gateway server and router
    await Promise.all([this.router.stop(), this.server.stop()]);
    this.isStarted = false;
  }
}

export { McpGateway };
