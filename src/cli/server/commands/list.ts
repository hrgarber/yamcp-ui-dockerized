import chalk from "chalk";
import prompts from "prompts";
import { McpProvider } from "../../../store/schema";
import { buildProviderTree } from "../../utils";
import treeify from "treeify";

export async function printProviders(providers: McpProvider[]) {
  if (providers.length === 0) {
    console.log(chalk.yellow("No MCP providers configured"));
    return;
  }

  console.log(chalk.bold("\nConfigured MCP Providers:"));
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
    console.log(chalk.yellow("\nProvider viewing cancelled."));
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
      message: "Select a provider to view details:",
      choices: providerOptions,
      hint: "- Use arrow-keys. Return to select. Ctrl+C to exit",
    },
    { onCancel }
  );

  if (response.selectedProvider) {
    const tree = buildProviderTree(response.selectedProvider);

    console.log("\nProvider Details:");
    console.log(chalk.dim("---------------"));
    console.log(treeify.asTree(tree, true, true));
    console.log("\n");
  }
}
