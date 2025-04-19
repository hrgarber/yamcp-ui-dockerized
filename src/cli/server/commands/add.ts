import chalk from "chalk";
import { addMcpProviders } from "../../../store/provider";
import { McpProvider } from "../../../store/schema";
import prompts from "prompts";
import { parseProviderParameters } from "../../utils";

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
    message: "Enter provider name:",
    validate: (value) => value.length > 0 || "Name cannot be empty",
  });

  if (!namePrompt.value) {
    console.log("Operation cancelled");
    return;
  }

  const name = namePrompt.value;

  if (providerType.value === "sse") {
    const urlPrompt = await prompts({
      type: "text",
      name: "value",
      message: "Enter provider URL:",
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
    });

    if (!urlPrompt.value) {
      console.log("Operation cancelled");
      return;
    }

    const provider: McpProvider = {
      type: "sse",
      namespace: name,
      providerParameters: {
        url: urlPrompt.value,
      },
    };

    addMcpProviders([provider]);
    console.log(chalk.green(`✔ SSE provider "${name}" added successfully`));
    return;
  }

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

  const provider = parseProviderParameters(name, {
    command: commandPrompt.value,
    env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
  });

  addMcpProviders([provider]);
  console.log(chalk.green(`✔ Command provider "${name}" added successfully`));
}
