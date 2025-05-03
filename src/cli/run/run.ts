import { Command } from "commander";
import { runGatewayAction } from "./actions/runGateway";

export function runCommand(program: Command) {
  program
    .command("run")
    .description("Run the gateway with a given workspace")
    .argument("<workspace-name>", "name of the workspace to run")
    .action((name) => {
      runGatewayAction(name);
    });
}
