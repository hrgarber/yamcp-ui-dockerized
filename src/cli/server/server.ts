import { Command } from "commander";
import { addProviderAction } from "./actions/add";
import { listProvidersAction } from "./actions/list";
import { removeProvidersAction } from "./actions/remove";
import { importProvidersAction } from "./actions/import";
import { scanProvidersAction } from "./actions/scan";
export function serverCommands(program: Command) {
  const server = program.command("server").description("Manage MCP providers");

  server
    .command("add")
    .description("Add a new MCP server (local or remote)")
    .action(async () => {
      console.clear();
      addProviderAction();
    });

  server
    .command("list")
    .description("List all MCP servers")
    .action(async () => {
      console.clear();
      listProvidersAction();
    });

  server
    .command("remove")
    .description("Remove a server")
    .argument("[name]", "name of the server to remove")
    .action(async (name) => {
      console.clear();
      removeProvidersAction(name);
    });

  server
    .command("import")
    .description("Import server configuration from a file")
    .argument("[config]", "path to the config file")
    .action(async (config) => {
      console.clear();
      importProvidersAction(config);
    });

  server
    .command("scan")
    .description("Scan the server's capabilities")
    .action(async () => {
      console.clear();
      scanProvidersAction();
    });

  return server;
}
