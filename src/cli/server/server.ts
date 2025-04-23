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
import { returnAndExit, scanProviderAndConfirm } from "../utils";
export function serverCommands(program: Command) {
  const server = program.command("server").description("Manage MCP providers");

  server
    .command("add")
    .description("Add a new MCP server (local or remote)")
    .action(async () => {
      addProvider();
    });

  server
    .command("list")
    .description("List all MCP servers")
    .action(() => {
      const providersMap = getMcpProviders();
      const providers = Object.values(providersMap);
      printProviders(providers);
    });

  server
    .command("remove")
    .description("Remove a server")
    .argument("<name>", "name of the server to remove")
    .action(async (name) => {
      const providers = getMcpProviders();

      if (!providers[name]) {
        console.error(chalk.red(`Server "${name}" not found`));
        return;
      }

      const response = await prompts({
        type: "confirm",
        name: "value",
        message: `Are you sure you want to remove server "${name}"?`,
        initial: false,
      });

      if (!response.value) {
        console.log("Operation cancelled");
        return;
      }

      removeMcpProvider(name);
      console.log(chalk.green(`✔ Server "${name}" removed successfully`));
    });

  server
    .command("import")
    .description("Import server configuration from a file")
    .argument("<config>", "path to the config file")
    .action(async (config) => {
      const providers = loadProviderConfigFile(config);
      if (providers?.length === 0) {
        console.error(
          chalk.red(
            "Failed to load provider configuration. The file is not valid or does not exist"
          )
        );
      }
      for (const provider of providers) {
        const confirmed = await scanProviderAndConfirm(provider);
        if (!confirmed) {
          returnAndExit(1);
        }
      }
      addMcpProviders(providers);
      console.log(chalk.green("✔ Server configuration imported successfully"));
      returnAndExit(0);
    });

  return server;
}
