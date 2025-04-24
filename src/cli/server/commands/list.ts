import chalk from "chalk";
import prompts from "prompts";
import { McpProvider } from "../../../store/schema";
import {
  buildProviderTree,
  printScanResult,
  returnAndExit,
} from "../../common";
import treeify from "treeify";
import {
  getScanFailures,
  isScanSuccessful,
  scanProvider,
} from "../../../providerScanner";

export async function printProviders(providers: McpProvider[]) {
  if (providers.length === 0) {
    console.log(chalk.yellow("No MCP servers configured"));
    return;
  }

  console.log(chalk.bold("\nConfigured MCP Servers:"));
  console.log(chalk.dim("----------------------"));

  // Create provider selection options
  const providerOptions = providers.map((provider) => {
    const tree = buildProviderTree(provider);
    return {
      title: `${provider.namespace} (${provider.type})`,
      value: provider,
      description: `${treeify.asTree(tree, true, true)}`,
    };
  });

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nServer viewing cancelled."));
    process.exit(0);
  };

  // Show initial list of providers
  providers.forEach((provider) => {
    console.log(
      `  ${chalk.green("•")} ${chalk.cyan(provider.namespace)} - ${chalk.dim(
        provider.type
      )}`
    );
  });

  // Provider selection prompt
  const response = await prompts(
    {
      type: "select",
      name: "selectedProvider",
      message: "Select a server to scan:",
      choices: providerOptions,
      hint: "- Use arrow-keys. Return to select. Ctrl+C to exit",
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
