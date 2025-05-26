#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if yamcp is installed globally
function checkYamcpInstalled() {
  return new Promise((resolve) => {
    const yamcp = spawn("yamcp", ["--version"], { stdio: "pipe" });
    yamcp.on("close", (code) => {
      resolve(code === 0);
    });
    yamcp.on("error", () => {
      resolve(false);
    });
  });
}

// Install yamcp globally
function installYamcp() {
  return new Promise((resolve, reject) => {
    console.log("📦 Installing yamcp@latest globally...");
    const npm = spawn("npm", ["install", "-g", "yamcp@latest"], {
      stdio: ["inherit", "inherit", "inherit"],
    });

    npm.on("close", (code) => {
      if (code === 0) {
        console.log("✅ yamcp installed successfully!");
        resolve(true);
      } else {
        console.error("❌ Failed to install yamcp");
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    npm.on("error", (error) => {
      console.error("❌ Failed to run npm install:", error.message);
      reject(error);
    });
  });
}

// Ask user for confirmation
function askUserConfirmation(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      const trimmedAnswer = answer.toLowerCase().trim();
      // Default to yes if empty answer (just pressed Enter)
      if (trimmedAnswer === "") {
        resolve(true);
      } else {
        resolve(trimmedAnswer === "y" || trimmedAnswer === "yes");
      }
    });
  });
}

async function main() {
  console.log("🍠 Starting YAMCP UI Dashboard...\n");

  // Check if yamcp is installed
  let yamcpInstalled = await checkYamcpInstalled();
  if (!yamcpInstalled) {
    console.log("⚠️  yamcp is not installed globally.");
    console.log("");

    const shouldInstall = await askUserConfirmation(
      "Would you like me to install yamcp for you? (Y/n): "
    );

    if (shouldInstall) {
      try {
        await installYamcp();

        // Verify installation
        yamcpInstalled = await checkYamcpInstalled();
        if (!yamcpInstalled) {
          console.error(
            "❌ Installation verification failed. Please try installing manually:"
          );
          console.error("  npm install -g yamcp@latest");
          process.exit(1);
        }
      } catch (error) {
        console.error("❌ Installation failed:", error.message);
        console.error("Please try installing manually:");
        console.error("  npm install -g yamcp@latest");
        process.exit(1);
      }
    } else {
      console.log("Please install yamcp manually and try again:");
      console.log("  npm install -g yamcp@latest");
      process.exit(1);
    }
  }

  console.log("✅ yamcp found");

  // Get the server script path
  const serverPath = join(__dirname, "..", "server.mjs");

  if (!existsSync(serverPath)) {
    console.error("❌ Error: server.mjs not found");
    console.error("Please reinstall yamcp-ui:");
    console.error("  npm install -g yamcp-ui");
    process.exit(1);
  }

  // Get port from environment or use default
  const port = process.env.PORT || 8765;

  console.log("🚀 Starting dashboard server...");
  console.log(`📱 Dashboard will be available at: http://localhost:${port}`);
  console.log("");
  console.log("💡 To use a different port: PORT=3000 npx yamcp-ui");
  console.log("Press Ctrl+C to stop the dashboard");
  console.log("");

  // Start the server
  const server = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: dirname(serverPath),
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping YAMCP UI Dashboard...");
    server.kill("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.kill("SIGTERM");
    process.exit(0);
  });

  server.on("close", (code) => {
    if (code !== 0) {
      console.error(`❌ Dashboard server exited with code ${code}`);
      process.exit(code);
    }
  });

  server.on("error", (error) => {
    console.error("❌ Failed to start dashboard server:", error.message);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error.message);
  process.exit(1);
});
