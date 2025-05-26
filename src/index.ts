#!/usr/bin/env node

import { Command } from "commander";
import { serverCommands } from "./cli/server/server";
import { workspaceCommands } from "./cli/workspace/workspace";
import { runCommand } from "./cli/run/run";
import { logCommand } from "./cli/log/log";
import { uiCommand } from "./cli/ui/ui";
import { VERSION } from "./config";

const program = new Command();

program.name("yamcp").description("YAMCP Gateway CLI").version(VERSION);
program.showHelpAfterError("(add --help for additional information)");
// Add server commands
serverCommands(program);

// Add workspace commands
workspaceCommands(program);

// Add run command
runCommand(program);

// Add log command
logCommand(program);

// Add UI command
uiCommand(program);

program.parseAsync(process.argv);
