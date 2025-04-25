import prompts from "prompts";
import { existsSync } from "fs";
import { EXAMPLE_SERVERS_CONFIG_PATH } from "../../../config";
import chalk from "chalk";
import { returnAndExit } from "../../common";
import { loadProviderConfigFile } from "../../../store/loader";
import { scanProviderAndConfirm } from "../../common";
import { addMcpProviders } from "../../../store/provider";

export async function importProvidersAction(config: string) {
  let configPath = config;
  if (!configPath) {
    if (existsSync(EXAMPLE_SERVERS_CONFIG_PATH)) {
      // if example config file exists, ask user to use it
      const response = await prompts({
        type: "confirm",
        name: "value",
        message:
          "No config file provided. Do you want to import the default servers?",
        initial: true,
      });
      if (response.value) {
        configPath = EXAMPLE_SERVERS_CONFIG_PATH;
      }
    }
  }
  // if no config file provided, or example config file is not used, exit
  if (!configPath) {
    console.error(chalk.red("No config file provided"));
    returnAndExit(1);
  }

  const providers = loadProviderConfigFile(configPath);
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
}
