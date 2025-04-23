import winston from "winston";
import path, { resolve } from "path";
import fs from "fs";
import { LOG_DIR } from "../config";
// Update the LogMessage interface to match MCP server's format
interface LogMessage {
  level:
    | "error"
    | "debug"
    | "info"
    | "notice"
    | "warning"
    | "critical"
    | "alert"
    | "emergency";
  data?: unknown;
  _meta?: Record<string, unknown>;
  logger?: string;
  [key: string]: unknown; // Add index signature for additional properties
}

const _logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
    }),
    // Write all logs with importance level of 'info' or less to 'combined.log'
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
    }),
  ],
});

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Helper function to format errors
const formatError = (
  error: unknown
): { errorMessage: string; metadata: Record<string, unknown> } => {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      metadata: {
        stack: error.stack,
        ...error, // Spread any additional properties
      },
    };
  }
  return {
    errorMessage: String(error),
    metadata: {},
  };
};

class Logger {
  info(message: string, metadata?: Record<string, unknown>) {
    _logger.info(message, metadata);
  }
  error(error: unknown, additionalMetadata?: Record<string, unknown>) {
    const { errorMessage, metadata } = formatError(error);
    _logger.error(errorMessage, {
      ...metadata,
      ...additionalMetadata,
    });
  }
  logMessage(logMsg: LogMessage) {
    const level = logMsg.level;
    const message =
      typeof logMsg.data === "string"
        ? logMsg.data
        : JSON.stringify(logMsg.data);
    _logger.log(level, message, logMsg._meta);
  }
  // Function to flush logs and exit
  async flushLogs() {
    return new Promise<void>(() => {
      _logger.end(() => {
        resolve();
      }); // Signal Winston to finish writing logs
    });
  }
}

const logger = new Logger();

export { logger };
export type { LogMessage };
