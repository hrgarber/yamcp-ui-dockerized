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
import { logger } from "./utility/logger.js";

class McpGateway {
  private server: GatewayServer;
  private router: GatewayRouter;
  private isStarted = false;

  constructor(router: GatewayRouter, server: GatewayServer) {
    this.server = server;
    this.router = router;
  }

  private async sendLoggingMessage(log: {
    level: "info" | "error";
    data: string;
  }) {
    if (this.isStarted) {
      this.server.mcpServer.sendLoggingMessage(log);
    }
    logger.logMessage(log);
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
        logger.logMessage({
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
        logger.logMessage({
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
        logger.logMessage({
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
        logger.logMessage({
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

    this.sendLoggingMessage({
      level: "info",
      data: "MCP Gateway started...",
    });

    // start the gateway server and router
    await this.router.start(providersConfig);
    await this.server.start();

    this.sendLoggingMessage({
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
    this.sendLoggingMessage({
      level: "info",
      data: "Shutting down gateway...",
    });
    // stop the gateway server and router
    await Promise.all([this.router.stop(), this.server.stop()]);
    this.isStarted = false;
  }
}

export { McpGateway };
