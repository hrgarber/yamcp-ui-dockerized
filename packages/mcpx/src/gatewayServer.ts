import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_VERSION, SERVER_NAME } from "./config";

export class GatewayServer {
  mcpServer: McpServer;
  transport: StdioServerTransport;
  constructor() {
    this.mcpServer = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
    this.transport = new StdioServerTransport();
  }
  async start() {
    this.mcpServer.connect(this.transport);
  }
  async stop() {
    if (this.mcpServer) {
      await this.mcpServer.close();
    }
  }
}
