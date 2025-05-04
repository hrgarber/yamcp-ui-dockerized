import chalk from "chalk";
import boxen from "boxen";
import prompts from "prompts";
import treeify from "treeify";
import {
  buildProviderTree,
  displayWorkspacesChoice,
  getWorkspaceProviders,
  returnAndExit,
} from "../../common/utils";
import { McpProvider } from "../../../store/schema";
import { WORKSPACES_CONFIG_PATH } from "../../../config";
import { loadProvidersMap } from "../../../store/loader";
import { getWorkspaces } from "../../../store/workspace";
export async function listWorkspaceAction(name?: string) {
  const workspaces = getWorkspaces();
  const availableProviders = loadProvidersMap();

  const workspaceCount = Object.keys(workspaces).length;

  if (workspaceCount === 0) {
    console.log(
      boxen(
        chalk.yellow(
          "No workspaces found\nUse 'yam create' to create a workspace"
        ),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "yellow",
        }
      )
    );
    return;
  }

  // If a specific workspace is requested, show it directly
  if (name) {
    displayWorkspace(name, workspaces[name]);
    return;
  }

  while (true) {
    // Clear console for better visibility
    console.clear();
    // Show config path if it exists
    if (WORKSPACES_CONFIG_PATH) {
      console.log(chalk.dim("Workspaces are configured in the config file:"));
      console.log(chalk.dim(WORKSPACES_CONFIG_PATH));
    }
    // displace list of workspaces to let user selec
    const selectedWorkspace = await displayWorkspacesChoice(workspaces);
    if (!selectedWorkspace) {
      returnAndExit(0);
    }
    // Display selected workspace
    console.clear();

    const wsProviders = getWorkspaceProviders(
      availableProviders,
      workspaces[selectedWorkspace]
    );
    await displayWorkspaceInteractive(selectedWorkspace, wsProviders);
  }
}

async function displayWorkspaceInteractive(
  name: string,
  providers: McpProvider[]
) {
  while (true) {
    // Create provider selection
    const choices = [
      ...providers.map((provider) => {
        const tree = buildProviderTree(provider);
        return {
          title: provider.namespace,
          value: provider.namespace,
          description: treeify.asTree(tree, true, true),
        };
      }),
      {
        title: "Back",
        value: "back",
        description: "Return to workspace list",
      },
    ];

    // No matter what, we break out of the loop to return to the workspace list
    await prompts({
      type: "select",
      name: "server",
      message: `See mcp server details in workspace "${name}" (use arrow keys)`,
      choices,
    });

    // No matter what, we break out of the loop to return to the workspace list
    break;
  }
}

function displayWorkspace(name: string, providers: string[] | undefined) {
  if (!providers) {
    console.log(
      boxen(chalk.red(`Workspace "${name}" not found`), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "red",
      })
    );
    return;
  }

  // ToDo: Show as tree
  console.log(
    chalk.bold(`Workspace: ${chalk.green(name)}\n\n`) +
      chalk.bold(`Servers (${providers.length}):\n`) +
      providers
        .map((provider) => `  ${chalk.green("•")} ${provider}`)
        .join("\n"),
    {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "green",
    }
  );
}
