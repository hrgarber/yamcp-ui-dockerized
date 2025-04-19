import chalk from "chalk";
import boxen from "boxen";
import prompts from "prompts";
import treeify from "treeify";
import { buildProviderTree, getWorkspaceProviders } from "../../utils";
import { McpProvider } from "../../../store/schema";

export async function listWorkspace(
  workspaces: Record<string, string[]>,
  availableProviders: Record<string, McpProvider>,
  name?: string
) {
  const workspaceCount = Object.keys(workspaces).length;

  if (workspaceCount === 0) {
    console.log(
      boxen(chalk.yellow("No workspaces found"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      })
    );
    return;
  }

  // If a specific workspace is requested, show it directly
  if (name) {
    displayWorkspace(name, workspaces[name]);
    return;
  }

  // Create tree structure for workspaces
  const workspaceTree: Record<string, Record<string, string>> = {};
  Object.entries(workspaces).forEach(([wsName, providers]) => {
    workspaceTree[wsName] = providers.reduce((acc, provider) => {
      acc[provider] = "";
      return acc;
    }, {} as Record<string, string>);
  });

  while (true) {
    // Clear console for better visibility
    console.clear();

    // Create selection list
    const choices = [
      ...Object.keys(workspaces).map((ws) => {
        const providerCount = workspaces[ws].length;
        const showCount = 4;
        const notDisplayedHint =
          providerCount > showCount
            ? `+ ${providerCount - showCount} more`
            : "";
        const description = `${providerCount} providers (${workspaces[ws]
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
      message: "Select a workspace to view details (use arrow keys)",
      choices,
    });

    if (!response.workspace || response.workspace === "exit") {
      break;
    }

    // Display selected workspace
    console.clear();

    const wsProviders = getWorkspaceProviders(
      availableProviders,
      workspaces[response.workspace]
    );
    await displayWorkspaceInteractive(response.workspace, wsProviders);
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
      name: "provider",
      message: `See mcp provider details in workspace "${name}" (use arrow keys)`,
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
      chalk.bold(`Providers (${providers.length}):\n`) +
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
