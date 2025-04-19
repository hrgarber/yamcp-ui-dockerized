import { z } from "zod";

// Define the Zod schema for provider parameters
const StdioProviderParametersSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

const SSEProviderParametersSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

// Union type for provider parameters matching ProviderParameters type
const ProviderParametersSchema = z.union([
  StdioProviderParametersSchema,
  SSEProviderParametersSchema,
]);

// Define the Zod schema for the provider config file that is used to load the providers
const ProviderConfigFileSchema = z.record(z.string(), ProviderParametersSchema);

// Define the schema for a single mcp provider
const McpProviderSchema = z.object({
  namespace: z.string().min(1, "Namespace cannot be empty"),
  type: z.enum(["stdio", "sse"]),
  providerParameters: ProviderParametersSchema,
});

// Define the schema for the provider store that is used to store the providers
const ProviderStoreSchema = z.record(z.string(), McpProviderSchema);

const WorkspaceMapSchema = z.record(z.string(), z.array(z.string()));

// Type inference from the Zod schema
type ProviderParameters = z.infer<typeof ProviderParametersSchema>;
type McpProvider = z.infer<typeof McpProviderSchema>;
type ProviderStore = z.infer<typeof ProviderStoreSchema>;
type SseProviderParameters = z.infer<typeof SSEProviderParametersSchema>;
type StdioProviderParameters = z.infer<typeof StdioProviderParametersSchema>;
type WorkspaceMap = z.infer<typeof WorkspaceMapSchema>;
function isStdioConfig(config: McpProvider): config is McpProvider & {
  type: "stdio";
  providerParameters: StdioProviderParameters;
} {
  return config.type === "stdio";
}

function isSSEConfig(config: McpProvider): config is McpProvider & {
  type: "sse";
  providerParameters: SseProviderParameters;
} {
  return config.type === "sse";
}

export {
  ProviderConfigFileSchema,
  McpProviderSchema,
  WorkspaceMapSchema,
  ProviderStoreSchema,
};
export type {
  McpProvider,
  ProviderParameters,
  ProviderStore,
  SseProviderParameters,
  StdioProviderParameters,
  WorkspaceMap,
};
export { isStdioConfig, isSSEConfig };
