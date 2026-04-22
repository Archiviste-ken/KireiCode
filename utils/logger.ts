type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLogLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[configuredLogLevel];
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    write("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    write("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    write("error", message, context);
  },
};
