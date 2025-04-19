import { Command } from "commander";
import chalk from "chalk";
import {
  addMcpProviders,
  getMcpProviders,
  removeMcpProvider,
} from "../../store/provider";
import { loadProviderConfigFile } from "../../store/loader";
import prompts from "prompts";
import { addProvider } from "./commands/add";
import { printProviders } from "./commands/list";
import { parseProviderParameters } from "../utils";
export function serverCommands(program: Command) {
  const server = program.command("server").description("Manage MCP providers");

  server
    .command("add")
    .description("Add a new MCP provider (local or remote)")
    .argument("[name]", "name of the provider")
    .option("--command <command>", "command to run the provider")
    .option(
      "--env [env...]",
      "environment variables for the command (key=value pairs)"
    )
    .option("--url <url>", "URL for the provider")
    .action((name, options) => {
      if (name) {
        // Non-interactive mode
        const mcpProviderConfig = parseProviderParameters(name, options);
        addMcpProviders([mcpProviderConfig]);
        console.log(chalk.green(`✔ Provider "${name}" added successfully`));
      } else {
        // Interactive mode
        addProvider();
      }
    });

  server
    .command("list")
    .description("List all MCP providers")
    .action(() => {
      const providersMap = getMcpProviders();
      const providers = Object.values(providersMap);
      printProviders(providers);
    });

  server
    .command("remove")
    .description("Remove a provider")
    .argument("<name>", "name of the provider to remove")
    .action(async (name) => {
      const providers = getMcpProviders();

      if (!providers[name]) {
        console.error(chalk.red(`Provider "${name}" not found`));
        return;
      }

      const response = await prompts({
        type: "confirm",
        name: "value",
        message: `Are you sure you want to remove provider "${name}"?`,
        initial: false,
      });

      if (!response.value) {
        console.log("Operation cancelled");
        return;
      }

      removeMcpProvider(name);
      console.log(chalk.green(`✔ Provider "${name}" removed successfully`));
    });

  server
    .command("import")
    .description("Import provider configuration from a file")
    .argument("<config>", "path to the config file")
    .action((config) => {
      const providers = loadProviderConfigFile(config);
      if (providers?.length === 0) {
        console.error(
          chalk.red(
            "Failed to load provider configuration. The file is not valid or does not exist"
          )
        );
      }
      addMcpProviders(providers);
      console.log(
        chalk.green("✔ Provider configuration imported successfully")
      );
    });

  return server;
}
