import { loadWorkspaceMap, saveWorkspaceMap } from "./loader";

export function addWorkspace(name: string, providerNames: string[]) {
  let config = loadWorkspaceMap();
  config = { ...config, [name]: providerNames };
  saveWorkspaceMap(config);
}

export function removeWorkspace(name: string) {
  let config = loadWorkspaceMap();
  delete config[name];
  saveWorkspaceMap(config);
}

export function getWorkspaces() {
  const config = loadWorkspaceMap();
  return config;
}
