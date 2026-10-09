import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from '../logger.js';

export async function startHttpTransport(server: McpServer, port: number = 3000): Promise<void> {
  const app = express();
  let transport: SSEServerTransport | null = null;

  app.get('/sse', async (_req: Request, res: Response) => {
    logger.info('Nueva conexión SSE recibida en /sse');
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
  });

  app.post('/messages', async (req: Request, res: Response) => {
    if (!transport) {
      res.status(400).send('No hay una sesión SSE activa inicializada');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      name: 'artifact-sdd-extractor-mcp',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`Servidor HTTP/SSE escuchando en http://localhost:${port}`);
      logger.info(`- SSE endpoint: http://localhost:${port}/sse`);
      logger.info(`- Health: http://localhost:${port}/health`);
      resolve();
    });
  });
}
