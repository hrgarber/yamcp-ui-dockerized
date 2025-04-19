import path from "path";
// Server
export const SERVER_NAME = "tesser_mcp_gateway";
export const SERVER_VERSION = "1.0.0";
export const PROVIDERS_CONFIG_PATH = path.join(
  __dirname,
  "./.state/providers.json"
);
export const WORKSPACES_CONFIG_PATH = path.join(
  __dirname,
  "./.state/workspaces.json"
);
export const LOG_DIR = path.join(__dirname, "./.logs");
