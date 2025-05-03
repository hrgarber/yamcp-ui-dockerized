#!/usr/bin/env node

import { Command } from "commander";
import { serverCommands } from "./cli/server/server";
import { workspaceCommands } from "./cli/workspace/workspace";
import { runCommand } from "./cli/run/run";
import { logCommand } from "./cli/log/log";
const program = new Command();

program.name("yamcp").description("YAMCP Gateway CLI").version("0.1.0");
program.showHelpAfterError("(add --help for additional information)");
// Add server commands
serverCommands(program);

// Add workspace commands
workspaceCommands(program);

// Add run command
runCommand(program);

// Add log command
logCommand(program);

program.parseAsync(process.argv);
