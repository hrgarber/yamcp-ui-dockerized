import { spawn } from "child_process";
import path from "path";
import chalk from "chalk";
import open from "open";
import ora from "ora";

interface UIOptions {
  port: string;
  open: boolean;
}

export async function launchUIAction(options: UIOptions) {
  const spinner = ora("Starting YAMCP Dashboard...").start();

  try {
    const uiPath = path.join(__dirname, "../../../../src/ui");
    const port = options.port || "3000";

    // Check if UI build exists
    const fs = await import("fs");
    const uiDistPath = path.join(uiPath, "dist");

    if (!fs.existsSync(uiDistPath)) {
      spinner.text =
        "UI build not found. Please run 'cd src/ui && npm run build' first.";
      spinner.fail();
      process.exit(1);
    }

    // Start the UI server
    const serverProcess = spawn("node", [path.join(uiPath, "server.cjs")], {
      env: { ...process.env, PORT: port },
      stdio: "pipe",
    });

    let serverStarted = false;

    serverProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Server running") && !serverStarted) {
        serverStarted = true;
        spinner.succeed(`YAMCP Dashboard started on http://localhost:${port}`);

        if (options.open) {
          open(`http://localhost:${port}`);
        }
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error(chalk.red(data.toString()));
    });

    // Fallback: assume server started after 2 seconds if no output received
    setTimeout(() => {
      if (!serverStarted) {
        serverStarted = true;
        spinner.succeed(`YAMCP Dashboard started on http://localhost:${port}`);

        if (options.open) {
          open(`http://localhost:${port}`);
        }
      }
    }, 2000);

    serverProcess.on("error", (error) => {
      spinner.fail(`Failed to start UI server: ${error.message}`);
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\nShutting down YAMCP Dashboard..."));
      serverProcess.kill();
      process.exit(0);
    });
  } catch (error) {
    spinner.fail(`Failed to start YAMCP Dashboard: ${error}`);
    process.exit(1);
  }
}
