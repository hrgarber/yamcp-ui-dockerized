import { Command } from "commander";
import {
  LOG_DIR,
  PROVIDERS_CONFIG_PATH,
  WORKSPACES_CONFIG_PATH,
} from "../../config";
import chalk from "chalk";

export function logCommand(program: Command) {
  program
    .command("log")
    .description("View logs")
    .action(() => {
      // print the LOG_DIR from config
      const logDir = LOG_DIR;
      if (logDir) {
        console.log(
          chalk.green(`\n\nYou can find logs in ${chalk.bold(logDir)}\n\n`)
        );
      } else {
        console.log(chalk.red("Logs directory not set"));
      }
    });
}
