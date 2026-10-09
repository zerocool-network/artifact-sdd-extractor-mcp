export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && envLevel in this.levels) {
      this.level = envLevel;
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${typeof meta === 'object' ? JSON.stringify(meta) : String(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [artifact-sdd-extractor] ${message}${metaStr}\n`;
  }

  debug(message: string, meta?: unknown): void {
    if (this.levels[this.level] <= this.levels.debug) {
      process.stderr.write(this.format('debug', message, meta));
    }
  }

  info(message: string, meta?: unknown): void {
    if (this.levels[this.level] <= this.levels.info) {
      process.stderr.write(this.format('info', message, meta));
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.levels[this.level] <= this.levels.warn) {
      process.stderr.write(this.format('warn', message, meta));
    }
  }

  error(message: string, meta?: unknown): void {
    if (this.levels[this.level] <= this.levels.error) {
      process.stderr.write(this.format('error', message, meta));
    }
  }
}

export const logger = new Logger();
