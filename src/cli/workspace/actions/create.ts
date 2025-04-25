import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";

import { addWorkspace } from "../../../store/workspace";
import { loadProvidersMap } from "../../../store/loader";

export async function createWorkspaceAction() {
  const providers = Object.values(loadProvidersMap());

  console.log(
    boxen(chalk.bold.cyan("MCP Workspace Creation Wizard"), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
    })
  );

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nWorkspace creation cancelled."));
    process.exit(0);
  };

  // Get workspace name
  const nameResponse = await prompts(
    {
      type: "text",
      name: "name",
      message: "Workspace name:",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "Workspace name is required";
        if (trimmed.length < 3) return "Name must be at least 3 characters";
        return true;
      },
    },
    { onCancel }
  );

  // Group servers by type for better organization
  const providersByType = providers.reduce((acc, provider) => {
    const key = provider.type.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(provider);
    return acc;
  }, {} as Record<string, typeof providers>);

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
      })),
    ]
  );

  // Select servers
  const serversResponse = await prompts(
    {
      type: "multiselect",
      name: "selectedServers",
      message: "Select servers to include:",
      choices: serverOptions,
      min: 1,
      instructions: false,
      hint: "- Space to select. Return to submit",
    },
    { onCancel }
  );

  // check if all groups are selected and
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

  // Confirmation prompt
  const confirmResponse = await prompts(
    {
      type: "confirm",
      name: "confirm",
      message: `Create workspace "${nameResponse.name}" with ${finalSelection.length} servers?`,
      initial: true,
    },
    { onCancel }
  );

  if (!confirmResponse.confirm) {
    console.log(chalk.yellow("\nWorkspace creation cancelled.\n"));
    return;
  }

  // Show progress spinner
  const spinner = ora("Creating workspace...").start();

  // Show which servers were selected
  const selectedServerObjects = providers.filter((s) =>
    finalSelection.includes(s.namespace)
  );

  const selectedServerNames = selectedServerObjects.map((s) => s.namespace);

  addWorkspace(nameResponse.name, selectedServerNames);

  spinner.succeed(
    chalk.green(`Workspace "${nameResponse.name}" created successfully!`)
  );

  console.log(
    boxen(
      chalk.bold(`Workspace: ${chalk.green(nameResponse.name)}\n\n`) +
        chalk.bold(`Servers (${selectedServerObjects.length}):\n`) +
        selectedServerObjects
          .map(
            (s) =>
              `  ${chalk.green("✓")} ${s.namespace}) - ${chalk.cyan(s.type)}`
          )
          .join("\n"),
      { padding: 1, borderColor: "green", borderStyle: "round" }
    )
  );

  console.log(
    chalk.dim(
      '\nTip: Use "mcp run ' +
        nameResponse.name +
        '" to start the gateway for this workspace.\n'
    )
  );
}
