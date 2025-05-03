import winston from "winston";
import path, { resolve } from "path";
import fs from "fs";
import { LOG_DIR } from "../config";
import { v4 as uuidv4 } from "uuid";

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

const createLogger = (namespace: string) => {
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(path.join(LOG_DIR, namespace))) {
    fs.mkdirSync(path.join(LOG_DIR, namespace), { recursive: true });
  }

  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      // Write all logs with importance level of 'error' or less to 'error.log'
      new winston.transports.File({
        filename: path.join(LOG_DIR, namespace, `error.log`),
        level: "error",
      }),
      // Write all logs with importance level of 'info' or less to 'combined.log'
      new winston.transports.File({
        filename: path.join(LOG_DIR, namespace, "combined.log"),
      }),
    ],
  });
};

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
  private ended = false;
  private logger: winston.Logger;
  constructor(namespace: string) {
    this.logger = createLogger(namespace);
  }
  info(message: string, metadata?: Record<string, unknown>) {
    if (this.ended) {
      return;
    }
    this.logger.info(message, metadata);
  }
  error(error: unknown, additionalMetadata?: Record<string, unknown>) {
    if (this.ended) {
      return;
    }
    const { errorMessage, metadata } = formatError(error);
    this.logger.error(errorMessage, {
      ...metadata,
      ...additionalMetadata,
    });
  }
  logMessage(logMsg: LogMessage) {
    if (this.ended) {
      return;
    }
    const level = logMsg.level;
    const message =
      typeof logMsg.data === "string"
        ? logMsg.data
        : JSON.stringify(logMsg.data);
    this.logger.log(level, message, logMsg._meta);
  }
  // Function to flush logs and exit
  async flushLogs() {
    return new Promise<void>(() => {
      this.logger.end(() => {
        this.ended = true;
        resolve();
      }); // Signal Winston to finish writing logs
    });
  }

  // Function to flush logs and exit
  async flushLogsAndExit(code: number) {
    return new Promise<void>(() => {
      this.logger.end(() => {
        this.ended = true;
        process.exit(code);
      }); // Signal Winston to finish writing logs
    });
  }
}

function getLogNamespace(workspaceName: string) {
  const randomString = uuidv4().replace(/-/g, "").substring(0, 8);
  return `${workspaceName}_${randomString}`;
}

export { Logger, getLogNamespace };
export type { LogMessage };
