import path from 'path';

export interface AppConfig {
  dbDsn: string | undefined;
  transport: 'stdio' | 'http';
  httpPort: number;
  queryTimeoutMs: number;
  maxRows: number;
  maxSddChars: number;
  exportDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): AppConfig {
  const exportDir = process.env.EXPORT_DIR || path.resolve(process.cwd(), 'exports');

  return {
    dbDsn: process.env.DB_DSN,
    transport: (process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio') as 'stdio' | 'http',
    httpPort: parseInt(process.env.HTTP_PORT || '3000', 10),
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10),
    maxRows: parseInt(process.env.MAX_ROWS || '10000', 10),
    maxSddChars: parseInt(process.env.MAX_SDD_CHARS || '500000', 10),
    exportDir,
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  };
}

export const config = loadConfig();
