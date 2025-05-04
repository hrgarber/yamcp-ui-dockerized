import type { TreeNode } from "../types";
import type { Logger } from "../../utility/logger";
import { Namespace } from "../../utility/namespace";
import chalk from "chalk";
import { McpProvider, isStdioConfig, isSSEConfig } from "../../store/schema";
import {
  scanProvider,
  isScanSuccessful,
  getScanFailures,
  ScanResult,
} from "../../providerScanner";
import prompts from "prompts";
import treeify from "treeify";

/**
 * Common CLI utilities and helpers for provider management, workspace handling, and user prompts.
 *
 * This module includes functions for parsing provider parameters, building provider trees,
 * displaying workspace choices, scanning providers, and printing scan results.
 * It is used throughout the CLI to facilitate user interaction and provider configuration.
 */

/**
 * Parses provider parameters and constructs a McpProvider object.
 *
 * @param name - The namespace or name of the provider.
 * @param options - Options containing either a command (with optional env) or a url.
 * @returns A McpProvider object configured with the given parameters.
 * @throws If neither command nor url is provided, or if command is missing.
 */
function parseProviderParameters(
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

/**
 * Builds a tree representation of a provider for display purposes.
 *
 * @param provider - The McpProvider to represent as a tree.
 * @returns A TreeNode representing the provider's configuration.
 */
function buildProviderTree(provider: McpProvider): TreeNode {
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

/**
 * Builds a list of provider options suitable for selection prompts.
 *
 * @param providers - Array of McpProvider objects.
 * @returns An array of prompt option objects with provider details in a tree format in the description.
 */
function buildDetailedProviderOptions(providers: McpProvider[]) {
  return providers.map((provider) => {
    const tree = buildProviderTree(provider);
    return {
      title: `- ${provider.namespace} (${provider.type})`,
      value: provider,
      description: `${treeify.asTree(tree, true, true)}`,
    };
  });
}

/**
 * Builds a list of provider options suitable for selection prompts.
 *
 * @param providers - Array of McpProvider objects.
 * @returns An array of prompt option objects with title, value, and description.
 */
function buildProviderOptions(providers: McpProvider[], description: string) {
  return providers.map((provider) => {
    return {
      title: `- ${provider.namespace} (${provider.type})`,
      value: provider,
      description,
    };
  });
}

/**
 * Retrieves providers from a record based on a workspace list, logging errors if not found.
 *
 * @param providers - Record of provider name to McpProvider.
 * @param workspace - Array of provider names (namespaces) in the workspace.
 * @param logger - Optional logger for error output.
 * @returns An array of found McpProvider objects (missing ones are filtered out).
 */
function getWorkspaceProviders(
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

/**
 * Exits the process with the given exit code.
 *
 * @param code - The exit code to use.
 */
function returnAndExit(code: number) {
  process.exit(code);
}

/**
 * Scans a provider and prompts the user to confirm adding it if the scan fails.
 *
 * @param mcpProvider - The provider to scan.
 * @param initial - Whether this is the initial scan (affects prompt default).
 * @returns True if the provider should be added, false otherwise.
 */
async function scanProviderAndConfirm(
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

/**
 * Prints the scan result in a tree format, showing tools, prompts, and resources.
 *
 * @param scanResult - The ScanResult object to display.
 */
function printScanResult(scanResult: ScanResult) {
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

/**
 * Builds a tree structure representing workspaces and their providers.
 *
 * @param workspaces - Record mapping workspace names to arrays of provider names.
 * @returns A nested object tree suitable for display.
 */
function buildWorkspaceTree(
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

/**
 * Displays a prompt for the user to select a workspace, with an option to exit.
 *
 * @param workspaces - Record mapping workspace names to arrays of provider names.
 * @param promptMessage - Optional custom prompt message.
 * @returns The selected workspace name, or undefined if exited.
 */
async function displayWorkspacesChoice(
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

function groupProvidersByType(providers: McpProvider[]) {
  return providers.reduce((acc, provider) => {
    const key = provider.type.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(provider);
    return acc;
  }, {} as Record<string, typeof providers>);
}

export {
  parseProviderParameters,
  buildProviderTree,
  buildDetailedProviderOptions,
  buildProviderOptions,
  getWorkspaceProviders,
  returnAndExit,
  scanProviderAndConfirm,
  printScanResult,
  buildWorkspaceTree,
  displayWorkspacesChoice,
  groupProvidersByType,
};
