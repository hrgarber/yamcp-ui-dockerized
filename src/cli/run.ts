import { Command } from "commander";
import { GatewayServer } from "../gatewayServer";
import { GatewayRouter } from "../gatewayRouter";
import { McpGateway } from "../gateway";
import { Logger } from "../utility/logger";
import { loadProvidersMap, loadWorkspaceMap } from "../store/loader";
import { getWorkspaceProviders } from "./common";
import { v4 as uuidv4 } from "uuid";
function getLogNamespace(workspaceName: string) {
  const randomString = uuidv4().replace(/-/g, "").substring(0, 8);
  return `${workspaceName}_${randomString}`;
}

async function runGateway(workspaceName: string) {
  let logger: Logger | undefined;
  // create a logger with a unique namespace for this run
  try {
    const logNamespace = getLogNamespace(workspaceName);
    logger = new Logger(logNamespace);
  } catch (error) {
    // TODO: consider if this should be fatal if logging is a requirement
    // logger failure does not stop the gateway
  }

  try {
    const providers = loadProvidersMap();
    const workspaces = loadWorkspaceMap();

    if (!workspaces[workspaceName]) {
      logger?.error(`Workspace ${workspaceName} not found`);
      throw new Error(`Workspace ${workspaceName} not found`);
    }

    const workspaceProviders = getWorkspaceProviders(
      providers,
      workspaces[workspaceName],
      logger
    );

    logger?.info(JSON.stringify(workspaceProviders, null, 2));
    const server = new GatewayServer();
    const router = new GatewayRouter(logger);
    // Create gateway instance
    const gateway = new McpGateway(router, server, logger);

    // Handle SIGINT
    process.on("SIGINT", async () => {
      try {
        await gateway.stop();
        logger?.info("Gateway stopped gracefully");
        await logger?.flushLogsAndExit(0);
      } catch (error) {
        logger?.error("Error stopping gateway", { error });
        await logger?.flushLogsAndExit(1);
      }
    });

    // Create proxy instance with logging hooks
    await gateway.start(workspaceProviders);
    logger?.info(
      "Gateway started successfully with loaded server configurations"
    );
  } catch (error) {
    logger?.error("Error starting gateway");
    logger?.error(error);
    await logger?.flushLogs();
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
