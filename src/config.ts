import path from "path";
import envPaths from "env-paths";

const paths = envPaths("yamcp");

// Server
export const SERVER_NAME = "yamcp_gateway";
export const SERVER_VERSION = "0.1.0";

// Store
const storeDir = paths.data;
export const PROVIDERS_CONFIG_PATH = path.join(storeDir, `./providers.json`);
export const WORKSPACES_CONFIG_PATH = path.join(storeDir, `./workspaces.json`);

export const EXAMPLE_SERVERS_CONFIG_PATH = path.join(
  __dirname,
  `./example-servers.json`
);

export const LOG_DIR = paths.log;
