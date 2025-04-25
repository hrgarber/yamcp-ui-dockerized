import { Command } from "commander";
import { createWorkspaceAction } from "./actions/create";
import { listWorkspaceAction } from "./actions/list";
import { editWorkspacesAction } from "./actions/edit";
import { scanWorkspacesAction } from "./actions/scan";
import { deleteWorkspaceAction } from "./actions/delete";
export function workspaceCommands(program: Command) {
  const workspace = program.command("ws").description("Manage MCP workspaces");

  workspace
    .command("create")
    .description("Create a new workspace")
    .action(async () => {
      console.clear();
      createWorkspaceAction();
    });

  workspace
    .command("list")
    .option("-n, --name <name>", "name of the workspace to list")
    .description("List workspaces")
    .action(async (options) => {
      console.clear();
      listWorkspaceAction(options.name);
    });

  workspace
    .command("edit")
    .description("Edit a workspace")
    .action(async () => {
      console.clear();
      editWorkspacesAction();
    });

  workspace
    .command("scan")
    .description("Scan workspaces")
    .action(async () => {
      console.clear();
      scanWorkspacesAction();
    });

  workspace
    .command("delete")
    .description("Delete a workspace")
    .argument("[workspace-name]", "name of the workspace to delete")
    .action(async (name) => {
      console.clear();
      deleteWorkspaceAction(name);
    });

  return workspace;
}
