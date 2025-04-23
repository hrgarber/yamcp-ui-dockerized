import chalk from "chalk";
import { addMcpProviders } from "../../../store/provider";
import { McpProvider, UrlSchema } from "../../../store/schema";
import prompts from "prompts";
import {
  parseProviderParameters,
  returnAndExit,
  scanProviderAndConfirm,
} from "../../utils";

export async function addProvider() {
  const providerType = await prompts({
    type: "select",
    name: "value",
    message: "Select provider type:",
    choices: [
      { title: "Local Command (stdio)", value: "stdio" },
      { title: "Remote Server (SSE)", value: "sse" },
    ],
  });

  if (!providerType.value) {
    console.log("Operation cancelled");
    return;
  }

  const namePrompt = await prompts({
    type: "text",
    name: "value",
    message: "Enter a name for the server (1-15 characters):",
    validate: (value) => {
      if (value.length === 0) {
        return "Name cannot be empty";
      } else if (value.length > 15) {
        return "Name cannot be longer than 15 characters";
      } else {
        return true;
      }
    },
  });

  if (!namePrompt.value) {
    console.log("Operation cancelled");
    return;
  }

  const name = namePrompt.value;
  let mcpProvider: McpProvider | undefined;

  if (providerType.value === "sse") {
    const urlPrompt = await prompts({
      type: "text",
      name: "value",
      message: "Enter server URL:",
      validate: (value) => {
        try {
          UrlSchema.parse(value);
          return true;
        } catch (error) {
          return `Please enter a valid URL e.g. https://example.com/`;
        }
      },
    });

    if (!urlPrompt.value) {
      console.log("Operation cancelled");
      return;
    }

    mcpProvider = {
      type: "sse",
      namespace: name,
      providerParameters: {
        url: urlPrompt.value,
      },
    };
  }

  if (providerType.value === "stdio") {
    const commandPrompt = await prompts({
      type: "text",
      name: "value",
      message: "Enter command:",
      validate: (value) => value.length > 0 || "Command cannot be empty",
    });

    if (!commandPrompt.value) {
      console.log("Operation cancelled");
      return;
    }

    const addEnvVars = await prompts({
      type: "confirm",
      name: "value",
      message: "Add environment variables?",
      initial: false,
    });

    let envVars: Record<string, string> = {};

    if (addEnvVars.value) {
      let addingEnv = true;
      while (addingEnv) {
        const envKey = await prompts({
          type: "text",
          name: "value",
          message: "Enter environment variable name:",
          validate: (value) => value.length > 0 || "Name cannot be empty",
        });

        if (!envKey.value) {
          addingEnv = false;
          continue;
        }

        const envValue = await prompts({
          type: "text",
          name: "value",
          message: `Enter value for ${envKey.value}:`,
        });

        if (envValue.value) {
          envVars[envKey.value] = envValue.value;
        }

        const continueAdding = await prompts({
          type: "confirm",
          name: "value",
          message: "Add another environment variable?",
          initial: false,
        });

        if (!continueAdding.value) {
          addingEnv = false;
        }
      }
    }

    mcpProvider = parseProviderParameters(name, {
      command: commandPrompt.value,
      env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    });
  }

  // scan provider
  if (mcpProvider) {
    const confirmed = await scanProviderAndConfirm(mcpProvider);
    if (!confirmed) {
      returnAndExit(1);
    }
    addMcpProviders([mcpProvider]);
    console.log(
      chalk.green(
        `✔ ${mcpProvider.type.toUpperCase()} server "${name}" added successfully`
      )
    );
    returnAndExit(0);
  }
}
