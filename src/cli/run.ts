import { Command } from "commander";
import { GatewayServer } from "../gatewayServer";
import { GatewayRouter } from "../gatewayRouter";
import { McpGateway } from "../gateway";
import { logger } from "../utility/logger";
import { loadProvidersMap, loadWorkspaceMap } from "../store/loader";
import { getWorkspaceProviders } from "./utils";

async function runGateway(workspaceName: string) {
  try {
    const providers = loadProvidersMap();
    const workspaces = loadWorkspaceMap();

    if (!workspaces[workspaceName]) {
      logger.error(`Workspace ${workspaceName} not found`);
      throw new Error(`Workspace ${workspaceName} not found`);
    }

    const workspaceProviders = getWorkspaceProviders(
      providers,
      workspaces[workspaceName]
    );

    logger.info(JSON.stringify(workspaceProviders, null, 2));
    const server = new GatewayServer();
    const router = new GatewayRouter();
    // Create gateway instance
    const gateway = new McpGateway(router, server);

    // Handle SIGINT
    process.on("SIGINT", async () => {
      try {
        await gateway.stop();
        logger.info("Gateway stopped gracefully");
        await logger.flushLogs();
        process.exit(0);
      } catch (error) {
        logger.error("Error stopping gateway", { error });
        await logger.flushLogs();
        process.exit(1);
      }
    });

    // Create proxy instance with logging hooks
    await gateway.start(workspaceProviders);
    logger.info(
      "Gateway started successfully with loaded provider configurations"
    );
  } catch (error) {
    logger.error("Error starting gateway");
    await logger.flushLogs();
  }
}

export function runCommand(program: Command) {
  program
    .command("run")
    .description("Run the gateway with a given workspace")
    .argument("<workspace-name>", "name of the workspace to run")
    .action((name) => {
      runGateway(name);
    });
}
