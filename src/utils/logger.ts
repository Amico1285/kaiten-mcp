type LogLevel = "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel: number =
  LEVELS[
    (process.env.LOG_LEVEL ?? "error") as LogLevel
  ] ?? LEVELS.error;

function log(
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  if (LEVELS[level] > currentLevel) return;

  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  const line = `[${tag}] ${ts} ${message}`;

  if (data !== undefined) {
    console.error(line, data);
  } else {
    console.error(line);
  }
}

export const logger = {
  error: (msg: string, data?: unknown) =>
    log("error", msg, data),
  warn: (msg: string, data?: unknown) =>
    log("warn", msg, data),
  info: (msg: string, data?: unknown) =>
    log("info", msg, data),
  debug: (msg: string, data?: unknown) =>
    log("debug", msg, data),
};
