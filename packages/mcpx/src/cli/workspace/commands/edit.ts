import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";

import { McpProvider } from "../../../store/schema";
import { addWorkspace } from "../../../store/workspace";

export async function editWorkspaces(
  workspaces: Record<string, string[]>,
  availableProviders: McpProvider[]
) {
  // Welcome message
  console.log(
    boxen(chalk.bold.cyan("Edit Workspace"), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
    })
  );

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nWorkspace editing cancelled."));
    process.exit(0);
  };

  const workspaceCount = Object.keys(workspaces).length;
  if (workspaceCount === 0) {
    console.log(
      boxen(chalk.yellow("No workspaces found to edit"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      })
    );
    return;
  }

  // Create workspace selection options
  const workspaceOptions = Object.entries(workspaces).map(
    ([name, providers]) => ({
      title: name,
      value: name,
      description: `${providers.length} provider${
        providers.length === 1 ? "" : "s"
      }`,
    })
  );

  // Select workspace to edit
  const workspaceResponse = await prompts(
    {
      type: "select",
      name: "workspace",
      message: "Select workspace to edit:",
      choices: workspaceOptions,
      hint: "- Use arrow-keys. Return to select",
    },
    { onCancel }
  );

  const selectedWorkspace = workspaceResponse.workspace;
  if (!selectedWorkspace) {
    console.log(
      chalk.yellow("\nNo workspace selected. Operation cancelled.\n")
    );
    return;
  }

  // Call the existing editWorkspace function with the selected workspace
  await editWorkspace(
    selectedWorkspace,
    workspaces[selectedWorkspace],
    availableProviders
  );
}

async function editWorkspace(
  workspaceName: string,
  currentProviders: string[],
  availableProviders: McpProvider[]
) {
  // Welcome message
  console.log(
    boxen(chalk.bold.cyan(`Edit Workspace: ${workspaceName}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
    })
  );

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nWorkspace editing cancelled."));
    process.exit(0);
  };

  // Group providers by type for better organization
  const providersByType = availableProviders.reduce((acc, provider) => {
    const key = provider.type.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(provider);
    return acc;
  }, {} as Record<string, typeof availableProviders>);

  // Create options for the multiselect prompt
  const serverOptions = Object.entries(providersByType).flatMap(
    ([type, providers]) => [
      {
        title: chalk.yellow(`---- ${type} MCP Servers ----`),
        value: `group_${type}`,
        group: type,
        description: `Select/deselect all ${type} servers`,
      },
      ...providers.map((provider) => ({
        title: `${provider.namespace}`,
        value: provider.namespace,
        description: `Select/deselect ${provider.namespace}`,
        group: type,
        selected: currentProviders.includes(provider.namespace),
      })),
    ]
  );

  // Show current configuration
  console.log(
    chalk.dim("\nCurrent configuration:") +
      `\n${currentProviders
        .map((p) => `  ${chalk.green("•")} ${p}`)
        .join("\n")}\n`
  );

  // Select servers
  const serversResponse = await prompts(
    {
      type: "multiselect",
      name: "selectedServers",
      message: "Update server selection:",
      choices: serverOptions,
      min: 1,
      instructions: false,
      hint: "- Space to select. Return to submit",
    },
    { onCancel }
  );

  // check if all groups are selected and expand selections
  const selections = serversResponse.selectedServers as string[];
  const expandedSelections = selections.reduce((acc, selection) => {
    if (selection.startsWith("group_")) {
      const type = selection.replace("group_", "");
      const providers = providersByType[type]?.map((p) => p.namespace) || [];
      return [...acc, ...providers];
    }
    return [...acc, selection];
  }, [] as string[]);

  // deduplicate selections
  const finalSelection = [...new Set(expandedSelections)];

  // Show changes summary
  const added = finalSelection.filter((p) => !currentProviders.includes(p));
  const removed = currentProviders.filter((p) => !finalSelection.includes(p));

  console.log("\nChanges summary:");
  if (added.length > 0) {
    console.log(chalk.green("\nAdded:"));
    added.forEach((p) => console.log(`  ${chalk.green("+")} ${p}`));
  }
  if (removed.length > 0) {
    console.log(chalk.red("\nRemoved:"));
    removed.forEach((p) => console.log(`  ${chalk.red("-")} ${p}`));
  }
  if (added.length === 0 && removed.length === 0) {
    console.log(chalk.dim("  No changes"));
  }

  // Confirmation prompt
  const confirmResponse = await prompts(
    {
      type: "confirm",
      name: "confirm",
      message: `Save changes to workspace "${workspaceName}"?`,
      initial: true,
    },
    { onCancel }
  );

  if (!confirmResponse.confirm) {
    console.log(chalk.yellow("\nWorkspace editing cancelled.\n"));
    return;
  }

  // Show progress spinner
  const spinner = ora("Updating workspace...").start();

  // Save the changes
  addWorkspace(workspaceName, finalSelection);

  spinner.succeed(
    chalk.green(`Workspace "${workspaceName}" updated successfully!`)
  );

  // Show final configuration
  console.log(
    boxen(
      chalk.bold(`Workspace: ${chalk.green(workspaceName)}\n\n`) +
        chalk.bold(`Providers (${finalSelection.length}):\n`) +
        finalSelection
          .map((provider) => `  ${chalk.green("•")} ${provider}`)
          .join("\n"),
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "green",
      }
    )
  );
}
