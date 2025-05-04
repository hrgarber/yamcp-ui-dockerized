import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";

import { addWorkspace } from "../../../store/workspace";
import { loadProvidersMap } from "../../../store/loader";
import { selectServersPrompt } from "../../common/prompts";
export async function createWorkspaceAction() {
  const providers = Object.values(loadProvidersMap());

  console.log(
    boxen(
      chalk.bold.cyan(
        providers.length > 0
          ? "YAMCP Workspace Creation Wizard"
          : "No servers found. \nUse `server add|import` to add some servers first."
      ),
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );

  if (providers.length === 0) {
    return;
  }

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

  console.clear();
  const finalSelection = await selectServersPrompt(providers, onCancel);

  // Confirmation prompt
  console.clear();
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

  // Show which servers were selected
  const selectedServerObjects = providers.filter((s) =>
    finalSelection.includes(s.namespace)
  );

  // Show progress spinner
  const spinner = ora("Creating workspace...").start();

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
