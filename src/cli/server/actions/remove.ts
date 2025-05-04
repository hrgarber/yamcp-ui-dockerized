import {
  removeMcpProvider,
  getMcpProviders,
  removeAllProviders,
} from "../../../store/provider";
import prompts, { type PromptType } from "prompts";
import chalk from "chalk";
import { buildProviderOptions, returnAndExit } from "../../common/utils";

function removeConfirmationPrompt(name: string) {
  return {
    type: "confirm" as PromptType,
    name: "removeConfirmed",
    message: `Are you sure you want to remove "${name}"?`,
    initial: false,
  };
}

export async function removeProvidersAction(name?: string) {
  const providers = getMcpProviders();

  if (name) {
    const provider = providers[name];
    // Check if provider exists
    if (!provider) {
      console.error(`Provider "${name}" not found`);
      return;
    }
    // Confirm removal
    const { removeConfirmed } = await prompts(removeConfirmationPrompt(name));
    if (!removeConfirmed) {
      console.log("Operation cancelled");
      return;
    }
    // Remove provider
    removeMcpProvider(name);
    console.log(chalk.green(`✔ Server "${name}" removed successfully`));
    returnAndExit(0);
  }

  // Create provider selection options
  const description = "Select a server to remove";
  const providerOptions = buildProviderOptions(
    Object.values(providers),
    description
  );
  const allProvidersOption = {
    title: "All servers",
    value: "all",
  };
  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nServer removal cancelled."));
    returnAndExit(0);
  };

  // Provider selection prompt
  const { selectedProvider } = await prompts(
    {
      type: "select",
      name: "selectedProvider",
      message: "Select a server to remove:",
      choices: [allProvidersOption, ...providerOptions],
      hint: "Use arrow keys to navigate, Enter to select, Esc or Ctrl+C to exit",
    },
    { onCancel }
  );

  if (selectedProvider === "all") {
    // Confirm removal all
    const { removeConfirmed } = await prompts(
      removeConfirmationPrompt("all servers.")
    );
    if (!removeConfirmed) {
      console.log("server removal cancelled");
      return;
    }

    removeAllProviders();

    console.log(chalk.green("✔ All servers removed successfully"));
    returnAndExit(0);
  } else {
    // Confirm removal of the selected provider
    const { removeConfirmed } = await prompts(
      removeConfirmationPrompt(selectedProvider.namespace)
    );
    if (!removeConfirmed) {
      console.log("Operation cancelled");
      return;
    }

    // Remove the selected provider
    removeMcpProvider(selectedProvider.namespace);
    console.log(
      chalk.green(
        `✔ Server "${selectedProvider.namespace}" removed successfully`
      )
    );
    returnAndExit(0);
  }
}
