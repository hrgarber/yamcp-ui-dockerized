import chalk from "chalk";
import { McpProvider } from "../../../store/schema";
import { printScanResult } from "../../common";
import {
  getScanFailures,
  scanProvider,
  isScanSuccessful,
} from "../../../providerScanner";

export async function scanProvidersAction(providers: McpProvider[]) {
  if (providers.length === 0) {
    console.log(chalk.yellow("No MCP providers configured"));
    return;
  }

  console.log(chalk.bold("\nConfigured MCP Providers:"));
  console.log(chalk.dim("----------------------"));

  // Show initial list of providers
  for (const mcpProvider of providers) {
    const scanResult = await scanProvider(mcpProvider);
    if (!isScanSuccessful(scanResult)) {
      console.log(
        chalk.red(`✘ Provider "${mcpProvider.namespace}" scan failed`)
      );
      console.log(chalk.red(getScanFailures(scanResult).join("\n")));
    }
    console.log(
      chalk.green(
        `✔ Provider "${mcpProvider.namespace}" was scanned successfully`
      )
    );
    printScanResult(scanResult);
  }
}
