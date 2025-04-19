import type { TreeNode } from "./types";

import { logger } from "../utility/logger";
import { Namespace } from "../utility/namespace";
import chalk from "chalk";
import { McpProvider, isStdioConfig, isSSEConfig } from "../store/schema";

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

export function getWorkspaceProviders(
  providers: Record<string, McpProvider>,
  workspace: Namespace[]
) {
  const workspaceProviders = workspace.map((wsProvider) => {
    const provider = providers[wsProvider];
    if (!provider) {
      logger.error(`Provider ${wsProvider} not found`);
    }
    return provider;
  });
  return workspaceProviders;
}
