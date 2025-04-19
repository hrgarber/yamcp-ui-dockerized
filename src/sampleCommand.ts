import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";
import { setTimeout } from "timers/promises";

// Mock data
const availableServers = [
  { id: "s1", name: "db-server-01", host: "192.168.1.10", type: "database" },
  { id: "s2", name: "web-server-01", host: "192.168.1.11", type: "web" },
  { id: "s3", name: "web-server-02", host: "192.168.1.12", type: "web" },
  { id: "s4", name: "cache-server", host: "192.168.1.13", type: "cache" },
  { id: "s5", name: "api-server", host: "192.168.1.14", type: "api" },
];

export async function createWorkspace() {
  // Welcome message in a box
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
  const serversByType = availableServers.reduce((acc, server) => {
    const key = server.type.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(server);
    return acc;
  }, {} as Record<string, typeof availableServers>);

  // Create options for the multiselect prompt
  const serverOptions = Object.entries(serversByType).flatMap(
    ([type, servers]) => [
      {
        title: chalk.yellow(`---- ${type} SERVERS ----`),
        disabled: true,
        value: null,
      },
      ...servers.map((server) => ({
        title: `${server.name} (${server.host})`,
        value: server.id,
        description: `Type: ${server.type}`,
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

  // Confirmation prompt
  const confirmResponse = await prompts(
    {
      type: "confirm",
      name: "confirm",
      message: `Create workspace "${nameResponse.name}" with ${serversResponse.selectedServers.length} servers?`,
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

  // Simulate processing time
  await setTimeout(1500);

  // Show which servers were selected
  const selectedServerObjects = availableServers.filter((s) =>
    serversResponse.selectedServers.includes(s.id)
  );

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
              `  ${chalk.green("✓")} ${s.name} (${s.host}) - ${chalk.cyan(
                s.type
              )}`
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

createWorkspace().then(() => {
  console.log("Done");
});
