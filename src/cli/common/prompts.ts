import { McpProvider } from "../../store/schema";
import prompts from "prompts";
import chalk from "chalk";
import { groupProvidersByType } from "./utils";

// select servers
async function selectServersPrompt(
  providers: McpProvider[],
  onCancel: () => void
) {
  // Group servers by type for better organization
  const providersByType = groupProvidersByType(providers);

  // Create choices for the multiselect prompt
  const serverOptions = Object.entries(providersByType).flatMap(
    ([type, providers]) => [
      {
        title: chalk.yellow(`---- ${type} MCP Servers ----`),
        value: `group_${type}`,
        group: type,
        description: `Select/deselect all ${type} servers`,
      },
      ...providers.map((provider) => ({
        title: `${provider.namespace}`,
        value: provider.namespace,
        description: `Select/deselect ${provider.namespace}`,
        group: type,
      })),
    ]
  );

  // Select servers
  const serversResponse = await prompts(
    {
      type: "multiselect",
      name: "selectedServers",
      message: "Select servers to include:",
      choices: serverOptions,
      min: 1,
      instructions: false,
      hint: "- Space to select. Return to submit",
    },
    { onCancel }
  );

  // check if all groups are selected and
  const selections = serversResponse.selectedServers as string[];
  const expandedSelections = selections.reduce((acc, selection) => {
    if (selection.startsWith("group_")) {
      const type = selection.replace("group_", "");
      const providers = providersByType[type]?.map((p) => p.namespace) || [];
      return [...acc, ...providers];
    }
    return [...acc, selection];
  }, [] as string[]);
  // deduplicate selections
  const finalSelection = [...new Set(expandedSelections)];
  return finalSelection;
}

export { selectServersPrompt };
