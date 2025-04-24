import { Command } from "commander";
import prompts from "prompts";
import { removeWorkspace, getWorkspaces } from "../../store/workspace";
import { loadProvidersMap } from "../../store/loader";
import { createWorkspace } from "./commands/create";
import { listWorkspace } from "./commands/list";
import { editWorkspaces } from "./commands/edit";
import { scanWorkspaces } from "./commands/scan";

export function workspaceCommands(program: Command) {
  const workspace = program.command("ws").description("Manage MCP workspaces");

  workspace
    .command("create")
    .description("Create a new workspace")
    .action(async () => {
      console.clear();
      const providers = loadProvidersMap();
      createWorkspace(Object.values(providers));
    });

  workspace
    .command("list")
    .option("-n, --name <name>", "name of the workspace to list")
    .description("List workspaces")
    .action(async (options) => {
      console.clear();
      const workspaces = getWorkspaces();
      const providers = loadProvidersMap();
      listWorkspace(workspaces, providers, options.name);
    });

  workspace
    .command("edit")
    .description("Edit a workspace")
    .action(async () => {
      console.clear();
      const workspaces = getWorkspaces();
      const providers = loadProvidersMap();
      editWorkspaces(workspaces, Object.values(providers));
    });

  workspace
    .command("scan")
    .description("Scan workspaces")
    .action(async () => {
      console.clear();
      const workspaces = getWorkspaces();
      const availableProviders = loadProvidersMap();
      scanWorkspaces(workspaces, availableProviders);
    });

  workspace
    .command("delete")
    .description("Delete a workspace")
    .argument("<workspace-name>", "name of the workspace to delete")
    .action(async (name) => {
      console.clear();
      const workspaces = getWorkspaces();

      if (!workspaces[name]) {
        console.error(`Workspace "${name}" not found`);
        return;
      }

      const response = await prompts({
        type: "confirm",
        name: "value",
        message: `Are you sure you want to delete workspace "${name}"?`,
        initial: false,
      });

      if (!response.value) {
        console.log("Operation cancelled");
        return;
      }

      removeWorkspace(name);
      console.log(`✔ Workspace "${name}" deleted successfully`);
    });

  return workspace;
}
