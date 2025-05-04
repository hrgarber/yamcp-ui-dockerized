import { McpProvider } from "./store/schema";
import {
  getProviderClientTransport,
  connectProviderClient,
} from "./providerClient";

export interface ScanResult {
  connection: {
    success: boolean;
    error?: string;
  };
  capabilities: {
    success: boolean;
    error?: string;
    data?: Capabilities;
  };
  version: {
    success: boolean;
    error?: string;
    data?: { version: string; name: string };
  };
}

interface Capabilities {
  experimental?: Record<string, boolean>;
  logging?: Record<string, boolean>;
  completion?: Record<string, boolean>;
  tools?: Record<string, boolean> & {
    list?: { name: string; description: string | undefined }[];
  };
  prompts?: Record<string, boolean> & {
    list?: { name: string; description: string | undefined }[];
  };
  resources?: Record<string, boolean> & {
    list?: { name: string; description: string | undefined }[];
  };
}

function createInitialScanResult(): ScanResult {
  return {
    connection: { success: false },
    capabilities: { success: false },
    version: { success: false },
  };
}

function toBooleanFlags(obj: any): Record<string, boolean> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, !!value])
  );
}

function transformCapabilities(capabilities: any): Capabilities {
  if (!capabilities) return {};
  return {
    experimental:
      capabilities.experimental && toBooleanFlags(capabilities.experimental),
    logging: capabilities.logging && toBooleanFlags(capabilities.logging),
    completion:
      capabilities.completion && toBooleanFlags(capabilities.completion),
    tools: capabilities.tools && toBooleanFlags(capabilities.tools),
    prompts: capabilities.prompts && toBooleanFlags(capabilities.prompts),
    resources: capabilities.resources && toBooleanFlags(capabilities.resources),
  };
}

export async function scanProvider(provider: McpProvider): Promise<ScanResult> {
  const result = createInitialScanResult();
  let client;
  try {
    // Step 1: Create transport
    let transport;
    try {
      transport = await getProviderClientTransport(provider);
    } catch (error) {
      result.connection.error = `Transport creation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return result;
    }

    // Step 2: Test connection and get client

    try {
      client = await connectProviderClient(transport);
      // At this point, we know that the connection is successful since the transport was created and connected
      result.connection.success = true;
    } catch (error) {
      result.connection.error = `Connection failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return result;
    }

    // Step 3: Check version
    try {
      const version = await client.getServerVersion();
      result.version.success = true;
      result.version.data = version;
    } catch (error) {
      result.version.error = `Version check failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    // Step 4: Check capabilities
    try {
      const caps = await client.getServerCapabilities();
      result.capabilities.success = true;
      result.capabilities.data = transformCapabilities(caps);
      if (result.capabilities.data.prompts) {
        const prompts = await client.listPrompts();
        result.capabilities.data.prompts.list =
          prompts.prompts?.map((prompt) => ({
            name: prompt.name,
            description: prompt.description || "",
          })) || [];
      }
      if (result.capabilities.data.tools) {
        const tools = await client.listTools();
        result.capabilities.data.tools.list =
          tools.tools?.map((tool) => ({
            name: tool.name,
            description: tool.description || "",
          })) || [];
      }
      if (result.capabilities.data.resources) {
        const resources = await client.listResources();
        result.capabilities.data.resources.list =
          resources.resources?.map((resource) => ({
            name: resource.name,
            description: resource.description || "",
          })) || [];
      }
    } catch (error) {
      result.capabilities.error = `Capabilities check failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  } catch (error) {
    // Unexpected error
    result.connection.error = `Unexpected error: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
  if (client) {
    client.close();
  }
  return result;
}

// Helper to check if scan was fully successful
export function isScanSuccessful(result: ScanResult): boolean {
  return (
    result.connection.success &&
    result.capabilities.success &&
    result.version.success
  );
}

// Helper to get a summary of failures
export function getScanFailures(result: ScanResult): string[] {
  const failures: string[] = [];
  if (!result.connection.success && result.connection.error) {
    failures.push(result.connection.error);
  }
  if (!result.capabilities.success && result.capabilities.error) {
    failures.push(result.capabilities.error);
  }
  if (!result.version.success && result.version.error) {
    failures.push(result.version.error);
  }
  return failures;
}
