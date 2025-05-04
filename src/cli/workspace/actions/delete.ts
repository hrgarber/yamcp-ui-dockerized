import prompts, { type PromptType } from "prompts";
import { getWorkspaces, removeWorkspace } from "../../../store/workspace";
import { displayWorkspacesChoice } from "../../common/utils";
import { returnAndExit } from "../../common/utils";
import chalk from "chalk";

function deleteConfirmationPrompt(name: string) {
  return {
    type: "confirm" as PromptType,
    name: "removeConfirmed",
    message: `Are you sure you want to remove "${name}"?`,
    initial: false,
  };
}

async function deleteWorkspaceWithConfirmation(name: string) {
  const response = await prompts(deleteConfirmationPrompt(name));

  if (!response.removeConfirmed) {
    console.log("Operation cancelled");
    return;
  }

  removeWorkspace(name);
  console.log(chalk.green(`✔ Workspace "${name}" deleted successfully`));
}

export async function deleteWorkspaceAction(name: string) {
  const workspaces = getWorkspaces();
  if (name) {
    if (!workspaces[name]) {
      console.error(`Workspace "${name}" not found`);
      return;
    }
    await deleteWorkspaceWithConfirmation(name);
    returnAndExit(0);
  }
  const selectedWorkspace = await displayWorkspacesChoice(
    workspaces,
    "Select a workspace to delete (use arrow keys)"
  );
  if (!selectedWorkspace) {
    returnAndExit(0);
  }
  await deleteWorkspaceWithConfirmation(selectedWorkspace);
  returnAndExit(0);
}
