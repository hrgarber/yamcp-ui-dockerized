import chalk from "chalk";
import prompts from "prompts";
import { getMcpProviders } from "../../../store/provider";
import {
  buildProviderOptions,
  printScanResult,
  returnAndExit,
} from "../../common/utils";

import {
  getScanFailures,
  isScanSuccessful,
  scanProvider,
} from "../../../providerScanner";
import { PROVIDERS_CONFIG_PATH } from "../../../config";

export async function listProvidersAction() {
  const providersMap = getMcpProviders();
  const providers = Object.values(providersMap);
  if (providers.length === 0) {
    console.log(chalk.yellow("No MCP servers configured"));
    return;
  }

  console.log(chalk.bold("\nConfigured MCP Servers:"));
  console.log(chalk.dim("----------------------"));
  if (PROVIDERS_CONFIG_PATH) {
    console.log(chalk.dim("Servers are configured in the config file:"));
    console.log(chalk.dim(PROVIDERS_CONFIG_PATH));
  }

  // Create provider selection options
  const description = "Select to list the server's capabilities";
  const providerOptions = buildProviderOptions(providers, description);

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nServer viewing cancelled."));
    returnAndExit(0);
  };

  // Provider selection prompt
  const response = await prompts(
    {
      type: "select",
      name: "selectedProvider",
      message: "Select a server to scan their capabilities:",
      choices: providerOptions,
      hint: "Use arrow keys to navigate, Enter to select, Esc or Ctrl+C to exit",
    },
    { onCancel }
  );

  if (response.selectedProvider) {
    const mcpProvider = response.selectedProvider;
    const scanResult = await scanProvider(mcpProvider);
    printScanResult(scanResult);
    if (!isScanSuccessful(scanResult)) {
      console.log(
        chalk.red(`✘ Mcp server "${mcpProvider.namespace}" scan failed`)
      );
      console.log(chalk.red(getScanFailures(scanResult).join("\n")));
      returnAndExit(1);
    }
    console.log(
      chalk.green(`✔ Mcp server "${mcpProvider.namespace}" scan was sucessfull`)
    );
    returnAndExit(0);
  }
}
