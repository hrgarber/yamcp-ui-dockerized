import path from "path";
// Server
export const SERVER_NAME = "tesser_mcp_gateway";
export const SERVER_VERSION = "1.0.0";

// Store
const storeDir = ".store";
export const PROVIDERS_CONFIG_PATH = path.join(
  __dirname,
  `./${storeDir}/providers.json`
);
export const WORKSPACES_CONFIG_PATH = path.join(
  __dirname,
  `./${storeDir}/workspaces.json`
);

// Logs
export const LOG_DIR = path.join(__dirname, `./.logs`);
