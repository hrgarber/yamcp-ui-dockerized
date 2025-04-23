import { Command } from "commander";
import { LOG_DIR } from "../../config";

export function logCommand(program: Command) {
  const log = program.command("log").description("View logs");
  // print the LOG_DIR from config
  const logDir = LOG_DIR;
  if (logDir) {
    console.log(`You can find logs in ${logDir}`);
  } else {
    console.log("Logs directory not set");
  }
  return log;
}
