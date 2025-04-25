import {
  displayWorkspacesChoice,
  getWorkspaceProviders,
  printScanResult,
  returnAndExit,
} from "../../common";
import { scanProvider } from "../../../providerScanner";
import { getScanFailures } from "../../../providerScanner";
import { isScanSuccessful } from "../../../providerScanner";
import chalk from "chalk";
import { loadProvidersMap } from "../../../store/loader";
import { getWorkspaces } from "../../../store/workspace";
export async function scanWorkspacesAction() {
  const workspaces = getWorkspaces();
  const availableProviders = loadProvidersMap();
  const selectedWorkspace = await displayWorkspacesChoice(workspaces);
  if (!selectedWorkspace) {
    return;
  }
  // Display selected workspace
  console.clear();

  const wsProviders = getWorkspaceProviders(
    availableProviders,
    workspaces[selectedWorkspace]
  );

  const scanReport: { failure: string[]; sucess: string[] } = {
    failure: [],
    sucess: [],
  };
  for (const provider of wsProviders) {
    // scan provider
    const scanResult = await scanProvider(provider);
    if (!isScanSuccessful(scanResult)) {
      console.log(
        chalk.red(`✘ Mcp server "${provider.namespace}" scan failed`)
      );
      console.log(chalk.red(getScanFailures(scanResult).join("\n")));
      scanReport.failure.push(provider.namespace);
    } else {
      console.log(
        chalk.green(`✔ Server "${provider.namespace}" scanned successfully`)
      );
      scanReport.sucess.push(provider.namespace);
    }
    printScanResult(scanResult);
  }
  console.log(
    chalk.green(`✔ Workspace "${selectedWorkspace}" scan completed.`)
  );
  console.log(`${chalk.green(scanReport.sucess.length)} scan succeeded:`);
  console.log(chalk.green(`  - ${scanReport.sucess.join(", ")}`));
  console.log(`${chalk.red(scanReport.failure.length)} scan failed":`);
  console.log(chalk.red(`  - ${scanReport.failure.join(", ")}`));
  returnAndExit(0);
}
