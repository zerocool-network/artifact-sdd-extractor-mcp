import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../logger.js';

export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  logger.info('Iniciando servidor MCP en modo stdio...');
  await server.connect(transport);
  logger.info('Servidor MCP conectado exitosamente a transporte stdio.');
}
