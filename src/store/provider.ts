import { loadProvidersMap, saveProviders, deleteProviders } from "./loader";
import type { McpProvider } from "./schema";

export function addMcpProviders(providers: McpProvider[]) {
  // append the providers to the config file
  const config = loadProvidersMap();

  // index the providers by namespace
  const newProviders = providers.reduce((acc, provider) => {
    acc[provider.namespace] = provider;
    return acc;
  }, {} as Record<string, McpProvider>);

  // save the new config
  saveProviders({ ...config, ...newProviders });
}

export function removeMcpProvider(name: string) {
  let config = loadProvidersMap();
  delete config[name];
  saveProviders(config);
}

export function removeAllProviders() {
  deleteProviders();
}

export function getMcpProviders() {
  const config = loadProvidersMap();
  return config;
}
