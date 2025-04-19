import fs from "fs";

import type { McpProvider, ProviderParameters, WorkspaceMap } from "./schema";
import {
  ProviderStoreSchema,
  ProviderConfigFileSchema,
  WorkspaceMapSchema,
} from "./schema";
import { z } from "zod";
import { WORKSPACES_CONFIG_PATH, PROVIDERS_CONFIG_PATH } from "../config";
import { mkdirIfNotExists } from "../utility/file";

function providerType(providerParameters: ProviderParameters): "stdio" | "sse" {
  if ("command" in providerParameters) {
    return "stdio";
  } else {
    return "sse";
  }
}

/**
 * Loads a file and returns the parsed data according to the provided schema.
 * If the file does not exist, returns an empty object.
 * If a transform function is provided, applies it to the parsed data before returning.
 * @param configPath - Path to the config file
 * @param schema - Zod schema to validate the config data
 * @param transform - Optional function to transform the validated data
 * @throws {Error} If the file exists but is not accessible or contains invalid JSON
 */
function loadFile<T, U = T>(
  configPath: string,
  schema: z.ZodType<T>,
  transform?: (data: T) => U
): U {
  if (!fs.existsSync(configPath)) {
    return (transform ? transform({} as T) : {}) as U;
  }

  try {
    fs.accessSync(configPath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Config file not accessible at ${configPath}: ${error.message}`
      );
    }
    throw new Error(`Config file not accessible at ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, "utf-8");
  let jsonConfig: unknown;

  try {
    jsonConfig = JSON.parse(configContent);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw new Error("Invalid JSON in config file");
  }

  const validatedConfig = schema.parse(jsonConfig);
  return transform
    ? transform(validatedConfig)
    : (validatedConfig as unknown as U);
}

/**
 * Loads the provider configs from the config file.
 * If the file does not exist, it returns an empty array.
 */
export function loadProviderConfigFile(configPath?: string) {
  const defaultConfigPath = PROVIDERS_CONFIG_PATH;
  const targetPath = configPath || defaultConfigPath;

  return loadFile(targetPath, ProviderConfigFileSchema, (config) =>
    Object.entries(config || {}).map(([namespace, parameters]) => ({
      namespace,
      type: providerType(parameters),
      providerParameters: parameters,
    }))
  );
}

/**
 * Loads the provider configs from the config file.
 * If the file does not exist, it returns an empty array.
 */
export function loadProvidersMap(configPath?: string) {
  const defaultConfigPath = PROVIDERS_CONFIG_PATH;
  const targetPath = configPath || defaultConfigPath;

  return loadFile(targetPath, ProviderStoreSchema);
}

export function loadWorkspaceMap(configPath?: string) {
  const defaultConfigPath = WORKSPACES_CONFIG_PATH;
  const targetPath = configPath || defaultConfigPath;

  return loadFile(targetPath, WorkspaceMapSchema);
}

export function saveProviders(
  providers: Record<string, McpProvider>,
  configPath?: string
) {
  const defaultConfigPath = PROVIDERS_CONFIG_PATH;
  const targetPath = configPath || defaultConfigPath;
  mkdirIfNotExists(targetPath);
  fs.writeFileSync(targetPath, JSON.stringify(providers, null, 2));
}

export function saveWorkspaceMap(
  workspaceMap: WorkspaceMap,
  configPath?: string
) {
  const defaultConfigPath = WORKSPACES_CONFIG_PATH;
  const targetPath = configPath || defaultConfigPath;

  mkdirIfNotExists(targetPath);
  fs.writeFileSync(targetPath, JSON.stringify(workspaceMap, null, 2));
}
