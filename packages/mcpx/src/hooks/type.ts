export interface GatewayHook {
  onMessage?: (
    message: any,
    direction: "client-to-server" | "server-to-client"
  ) => void;
  onError?: (error: Error) => void;
}
