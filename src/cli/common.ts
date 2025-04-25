import type { TreeNode } from "./types";
import type { Logger } from "../utility/logger";
import { Namespace } from "../utility/namespace";
import chalk from "chalk";
import { McpProvider, isStdioConfig, isSSEConfig } from "../store/schema";
import {
  scanProvider,
  isScanSuccessful,
  getScanFailures,
  ScanResult,
} from "../providerScanner";
import prompts from "prompts";
import treeify from "treeify";

export function parseProviderParameters(
  name: string,
  options: { command?: string; env?: string[]; url?: string }
): McpProvider {
  if (options.url) {
    return {
      type: "sse",
      namespace: name,
      providerParameters: {
        url: options.url,
      },
    };
  }

  if (options.command) {
    // Split command into command and args, handling quoted arguments
    const parts = options.command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = parts[0];
    if (!command) {
      throw new Error("Command is missing");
    }
    const args = parts.slice(1).map((arg) => arg.replace(/^"(.*)"$/, "$1"));

    const envVars: Record<string, string> = {};
    if (options.env) {
      for (const envPair of options.env) {
        const [key, value] = envPair.split("=");
        if (key && value) {
          envVars[key] = value;
        }
      }
    }

    return {
      type: "stdio",
      namespace: name,
      providerParameters: {
        command,
        args,
        env: envVars,
      },
    };
  }
  throw new Error("Either command or url must be provided");
}

export function buildProviderTree(provider: McpProvider): TreeNode {
  let subtree: TreeNode = {};
  if (isStdioConfig(provider)) {
    subtree = {
      [`Command: ${provider.providerParameters.command}`]: {},
    };

    if (provider.providerParameters.args?.length) {
      subtree[`Args: ${provider.providerParameters.args.join(" ")}`] = {};
    }

    const envVars = provider.providerParameters.env;
    if (Object.keys(envVars || {}).length > 0) {
      const envTree: TreeNode = {};
      Object.entries(envVars || {}).forEach(([key, value]) => {
        envTree[chalk.dim(`${key}=${value}`)] = {};
      });
      subtree["Environment Variables"] = envTree;
    }
  } else if (isSSEConfig(provider)) {
    subtree = {
      [`URL: ${provider.providerParameters.url}`]: {},
    };
  }
  const tree: TreeNode = {};
  tree[chalk.bold.cyan(provider.namespace)] = {
    [`Type: ${provider.type}`]: {},
    ...subtree,
  };
  return tree;
}

// Create provider selection options
export function buildProviderOptions(providers: McpProvider[]) {
  return providers.map((provider) => {
    const tree = buildProviderTree(provider);
    return {
      title: `- ${provider.namespace} (${provider.type})`,
      value: provider,
      description: `${treeify.asTree(tree, true, true)}`,
    };
  });
}

export function getWorkspaceProviders(
  providers: Record<string, McpProvider>,
  workspace: Namespace[],
  logger?: Logger
) {
  const workspaceProviders = workspace.map((wsProvider) => {
    const provider = providers[wsProvider];
    if (!provider) {
      if (logger) {
        logger.error(`Provider ${wsProvider} not found`);
      } else {
        console.error(chalk.red(`✘Provider ${wsProvider} not found`));
      }
    }
    return provider;
  });
  return workspaceProviders.filter((provider) => provider);
}

export function returnAndExit(code: number) {
  process.exit(code);
}

export async function scanProviderAndConfirm(
  mcpProvider: McpProvider,
  initial: boolean = false
) {
  const scanResult = await scanProvider(mcpProvider);
  if (!isScanSuccessful(scanResult)) {
    console.log(
      chalk.red(`✘ Mcp server "${mcpProvider.namespace}" scan failed`)
    );
    console.log(chalk.red(getScanFailures(scanResult).join("\n")));
    const continueAdding = await prompts({
      type: "confirm",
      name: "value",
      message: "Scan failed, Do you still want to add provider?",
      initial: initial,
    });

    if (!continueAdding.value) {
      return false;
    }
  }
  console.log(
    chalk.green(`✔ Server "${mcpProvider.namespace}" imported successfully`)
  );
  printScanResult(scanResult);
  return true;
}

export function printScanResult(scanResult: ScanResult) {
  type CapabilityTree = {
    [key: string]: string | CapabilityTree;
  };

  const tools = scanResult.capabilities.data?.tools?.list;
  const prompts = scanResult.capabilities.data?.prompts?.list;
  const resources = scanResult.capabilities.data?.resources?.list;

  const tree: CapabilityTree = {};

  if (tools?.length && tools.length > 0) {
    tree["Tools"] = {};
    const toolsNode: CapabilityTree = {};
    tools.forEach((tool) => {
      toolsNode[tool.name] = {};
    });
    tree["Tools"] = toolsNode;
  }

  if (prompts?.length && prompts.length > 0) {
    tree["Prompts"] = {};
    const promptsNode: CapabilityTree = {};
    prompts.forEach((prompt) => {
      promptsNode[prompt.name] = {};
    });
    tree["Prompts"] = promptsNode;
  }

  if (resources?.length && resources.length > 0) {
    tree["Resources"] = {};
    const resourcesNode: CapabilityTree = {};
    resources.forEach((resource) => {
      resourcesNode[resource.name] = {};
    });
    tree["Resources"] = resourcesNode;
  }

  if (Object.keys(tree).length > 0) {
    console.log(chalk.bold("Server Capabilities:"));
    console.log(chalk.dim("---------------------"));
    console.log(treeify.asTree(tree, true, true));
  }
}

export function buildWorkspaceTree(
  workspaces: Record<string, string[]>
): Record<string, Record<string, string>> {
  // Create tree structure for workspaces
  const workspaceTree: Record<string, Record<string, string>> = {};
  Object.entries(workspaces).forEach(([wsName, providers]) => {
    workspaceTree[wsName] = providers.reduce((acc, provider) => {
      acc[provider] = "";
      return acc;
    }, {} as Record<string, string>);
  });
  return workspaceTree;
}

export async function displayWorkspacesChoice(
  workspaces: Record<string, string[]>,
  promptMessage: string = "Select a workspace to view details (use arrow keys)"
) {
  // Create selection list
  const choices = [
    ...Object.keys(workspaces).map((ws) => {
      const providerCount = workspaces[ws].length;
      const showCount = 4;
      const notDisplayedHint =
        providerCount > showCount ? `+ ${providerCount - showCount} more` : "";
      const description = `${providerCount} servers (${workspaces[ws]
        .slice(0, showCount)
        .join(", ")} ${notDisplayedHint})`;
      return {
        title: ws,
        value: ws,
        description: description,
      };
    }),
    {
      title: "Exit",
      value: "exit",
      description: "Return to main menu",
    },
  ];

  const response = await prompts({
    type: "select",
    name: "workspace",
    message: promptMessage,
    choices,
  });

  if (!response.workspace || response.workspace === "exit") {
    return;
  } else {
    return response.workspace;
  }
}
