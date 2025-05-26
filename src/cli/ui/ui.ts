import { Command } from "commander";
import { launchUIAction } from "./actions/launch";

export function uiCommand(program: Command) {
  const ui = program.command("ui").description("Launch the YAMCP dashboard UI");

  ui.option("-p, --port <port>", "port to run the UI on", "3000")
    .option("--no-open", "don't open browser automatically")
    .description("Launch the YAMCP dashboard UI")
    .action(async (options: { port: string; open: boolean }) => {
      console.clear();
      launchUIAction(options);
    });

  return ui;
}
