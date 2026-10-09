#!/usr/bin/env node

import { config } from './config.js';
import { logger } from './logger.js';
import { createMcpServer } from './server.js';
import { startStdioTransport } from './transport/stdio.js';
import { startHttpTransport } from './transport/http.js';

async function main() {
  const args = process.argv.slice(2);
  let transportMode = config.transport;
  let httpPort = config.httpPort;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' && args[i + 1]) {
      transportMode = args[i + 1] === 'http' ? 'http' : 'stdio';
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      httpPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      process.stderr.write(`
artifact-sdd-extractor-mcp v1.0.0
Generador de SDDs con trazabilidad total y cero alucinaciones a partir de artifacts de Claude.

Uso:
  artifact-sdd-extractor-mcp [opciones]

Opciones:
  --transport <stdio|http>   Modo de transporte MCP (default: stdio)
  --port <numero>            Puerto para transporte HTTP/SSE (default: 3000)
  --help, -h                 Muestra este mensaje de ayuda

Variables de entorno:
  DB_DSN                     Cadena de conexión de solo lectura a la BD
  MCP_TRANSPORT              "stdio" o "http"
  HTTP_PORT                  Puerto HTTP (default 3000)
  EXPORT_DIR                 Directorio de exportación de SDDs
  LOG_LEVEL                  debug, info, warn, error
\n`);
      process.exit(0);
    }
  }

  const server = createMcpServer();

  if (transportMode === 'http') {
    await startHttpTransport(server, httpPort);
  } else {
    await startStdioTransport(server);
  }
}

main().catch((err) => {
  logger.error('Error fatal al iniciar artifact-sdd-extractor-mcp:', err);
  process.exit(1);
});
