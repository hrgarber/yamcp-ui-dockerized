import path from "path";
import envPaths from "env-paths";

const paths = envPaths("mcpx");

// Server
export const SERVER_NAME = "tesser_mcp_gateway";
export const SERVER_VERSION = "1.0.0";

// Store
const storeDir = paths.data;
export const PROVIDERS_CONFIG_PATH = path.join(storeDir, `./providers.json`);
export const WORKSPACES_CONFIG_PATH = path.join(storeDir, `./workspaces.json`);

export const LOG_DIR = paths.log;
