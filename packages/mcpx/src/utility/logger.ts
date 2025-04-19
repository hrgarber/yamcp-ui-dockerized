import winston from "winston";
import path from "path";
import fs from "fs";

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

const logsDir = path.join(__dirname, "logs");

const _logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
    // Write all logs with importance level of 'info' or less to 'combined.log'
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
    }),
  ],
});

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = {
  info: (message: string, metadata?: Record<string, unknown>) => {
    _logger.info(message, metadata);
  },
  error: (message: string, metadata?: Record<string, unknown>) => {
    _logger.error(message, metadata);
  },
  logMessage: (logMsg: LogMessage) => {
    const level = logMsg.level;
    const message =
      typeof logMsg.data === "string"
        ? logMsg.data
        : JSON.stringify(logMsg.data);
    _logger.log(level, message, logMsg._meta);
  },
  // Function to flush logs and exit
  flushLogsAndExit: (code: number) => {
    _logger.on("finish", () => {
      process.exit(code);
    });
    _logger.end(); // Signal Winston to finish writing logs
  },
};

export { logger };
export type { LogMessage };
