import chalk from "chalk";
import { printScanResult } from "../../common/utils";
import {
  getScanFailures,
  scanProvider,
  isScanSuccessful,
} from "../../../providerScanner";
import { getMcpProviders } from "../../../store/provider";
import { selectServersPrompt } from "../../common/prompts";
import { returnAndExit } from "../../common/utils";

export async function scanProvidersAction() {
  const providers = Object.values(getMcpProviders());
  if (providers.length === 0) {
    console.log(chalk.yellow("No MCP providers configured"));
    return;
  }

  console.log(chalk.bold("\nConfigured MCP Providers:"));
  console.log(chalk.dim("----------------------"));

  // Handle CTRL+C gracefully
  const onCancel = () => {
    console.log(chalk.yellow("\nServer scanning cancelled."));
    returnAndExit(0);
  };

  // Show initial list of providers
  const selectedProviderNames = await selectServersPrompt(providers, onCancel);
  console.log(selectedProviderNames);
  // Show which servers were selected
  const selectedProviders = providers.filter((s) =>
    selectedProviderNames.includes(s.namespace)
  );
  const scanReport: { failure: string[]; sucess: string[] } = {
    failure: [],
    sucess: [],
  };
  for (const mcpProvider of selectedProviders) {
    const scanResult = await scanProvider(mcpProvider);
    printScanResult(scanResult);
    if (!isScanSuccessful(scanResult)) {
      console.log(
        chalk.red(`✘ Mcp server "${mcpProvider.namespace}" scan failed`)
      );
      console.log(chalk.red(getScanFailures(scanResult).join("\n")));
      scanReport.failure.push(mcpProvider.namespace);
    } else {
      console.log(
        chalk.green(
          `✔ Mcp server "${mcpProvider.namespace}" scan was sucessfull`
        )
      );
      scanReport.sucess.push(mcpProvider.namespace);
    }
  }
  console.log(chalk.green(`✔ scan completed.`));
  console.log(`${chalk.green(scanReport.sucess.length)} scan succeeded:`);
  console.log(chalk.green(`  - ${scanReport.sucess.join(", ")}`));
  console.log(`${chalk.red(scanReport.failure.length)} scan failed":`);
  console.log(chalk.red(`  - ${scanReport.failure.join(", ")}`));
  returnAndExit(0);
}
