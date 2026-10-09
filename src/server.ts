import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ArtifactSddService, defaultArtifactService } from './service.js';
import { logger } from './logger.js';

export function createMcpServer(service: ArtifactSddService = defaultArtifactService): McpServer {
  const server = new McpServer({
    name: 'artifact-sdd-extractor-mcp',
    version: '1.0.0',
  });

  // Tool 1: ingest_artifact_source
  server.tool(
    'ingest_artifact_source',
    'Recibe el código del artifact (texto o múltiples archivos) asociado a un artifact_id; valida, almacena y versiona determinísticamente.',
    {
      artifact_id: z.string().describe('Identificador único del artifact (ej: "crm-v1")'),
      code: z.string().optional().describe('Código fuente completo del artifact pegado como texto'),
      files: z
        .array(
          z.object({
            path: z.string().describe('Ruta relativa del archivo (ej: "App.tsx", "styles.css")'),
            content: z.string().describe('Contenido del archivo'),
          })
        )
        .optional()
        .describe('Lista estructurada de archivos cuando el artifact contiene múltiples archivos'),
    },
    async ({ artifact_id, code, files }) => {
      try {
        if (!code && (!files || files.length === 0)) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Error: Debe proporcionar al menos "code" (texto) o una lista de "files".',
              },
            ],
          };
        }

        const sourceInput = files && files.length > 0 ? files : code!;
        const result = service.ingestArtifact(artifact_id, sourceInput);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  artifact_id: result.artifactId,
                  version_hash: result.versionHash,
                  ingested_at: result.ingestedAt,
                  summary: result.summary,
                  files: result.files.map(f => f.path),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en ingest_artifact_source (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error al ingerir artifact: ${err.message}` }],
        };
      }
    }
  );

  // Tool 2: parse_design_tokens
  server.tool(
    'parse_design_tokens',
    'Extrae tokens de estilo del código (colores reales, fuentes, tamaños, espaciados, radios, sombras, breakpoints) con evidencia [SRC-CODE: archivo:línea].',
    {
      artifact_id: z.string().describe('Identificador del artifact ingerido'),
    },
    async ({ artifact_id }) => {
      try {
        const tokens = service.parseTokens(artifact_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  artifact_id,
                  total_tokens: tokens.length,
                  tokens,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en parse_design_tokens (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: ${err.message}` }],
        };
      }
    }
  );

  // Tool 3: extract_component_inventory
  server.tool(
    'extract_component_inventory',
    'Genera el inventario de componentes y pantallas (botones, cards, tablas, modales...) con props, variantes y estados, citando evidencia de código.',
    {
      artifact_id: z.string().describe('Identificador del artifact ingerido'),
    },
    async ({ artifact_id }) => {
      try {
        const components = service.extractComponents(artifact_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  artifact_id,
                  total_components: components.length,
                  components,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en extract_component_inventory (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: ${err.message}` }],
        };
      }
    }
  );

  // Tool 4: extract_layout
  server.tool(
    'extract_layout',
    'Extrae la estructura de layout de las pantallas (grids, flex, breakpoints y comportamiento responsive) con evidencia [SRC-CODE].',
    {
      artifact_id: z.string().describe('Identificador del artifact ingerido'),
      screen: z.string().optional().describe('Nombre de la pantalla o vista a inspeccionar (default: "Main")'),
    },
    async ({ artifact_id, screen }) => {
      try {
        const layout = service.extractLayout(artifact_id, screen);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  artifact_id,
                  layout,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en extract_layout (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: ${err.message}` }],
        };
      }
    }
  );

  // Tool 5: extract_data_model
  server.tool(
    'extract_data_model',
    'Introspecciona el modelo de datos (entidades, tipos, columnas, relaciones) a partir de los datos pasados por el cliente, archivo DDL o interfaces del código.',
    {
      artifact_id: z.string().describe('Identificador del artifact'),
      entities: z.array(z.any()).optional().describe('Entidades y columnas ya obtenidas por el cliente (ej: vía Tabularis)'),
      schema_sql: z.string().optional().describe('Sentencias DDL SQL opcionales'),
      db_dsn: z.string().optional().describe('Cadena opcional de conexión si se desea introspección directa'),
    },
    async ({ artifact_id, entities, schema_sql, db_dsn }) => {
      try {
        const dataModel = await service.extractDataModel(artifact_id, {
          entities,
          schemaSql: schema_sql,
          dbDsn: db_dsn,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  artifact_id,
                  total_entities: dataModel.entities.length,
                  total_relationships: dataModel.relationships.length,
                  entities: dataModel.entities,
                  relationships: dataModel.relationships,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en extract_data_model (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: ${err.message}` }],
        };
      }
    }
  );

  // Tool 6: generate_sdd
  server.tool(
    'generate_sdd',
    'Consolida los planos de diseño y datos para generar el SDD completo en Markdown con plantilla fija, trazabilidad total y Anexo A de [SIN FUENTE].',
    {
      artifact_id: z.string().describe('Identificador del artifact ingerido'),
      title: z.string().optional().describe('Título personalizado para el SDD'),
      version: z.string().optional().describe('Versión del documento (ej: "1.0.0")'),
      author: z.string().optional().describe('Nombre del autor o equipo'),
      entities: z.array(z.any()).optional().describe('Entidades de base de datos ya conocidas por el cliente (ej: de Tabularis) para incluir en el SDD'),
      strict: z.boolean().optional().describe('Si es true, valida estrictamente que no existan tablas técnicas sin evidencia'),
    },
    async ({ artifact_id, title, version, author, entities, strict }) => {
      try {
        const sdd = await service.generateSdd({
          artifactId: artifact_id,
          title,
          version,
          author,
          entities,
          strict,
        });

        return {
          content: [
            {
              type: 'text',
              text: sdd,
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en generate_sdd (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error al generar SDD: ${err.message}` }],
        };
      }
    }
  );

  // Tool 7: export_sdd
  server.tool(
    'export_sdd',
    'Guarda el SDD generado en un archivo dentro de EXPORT_DIR o lo devuelve inline.',
    {
      artifact_id: z.string().describe('Identificador del artifact'),
      destination: z.enum(['file', 'inline']).optional().describe('Destino de la exportación ("file" o "inline", default: "file")'),
      filename: z.string().optional().describe('Nombre opcional de archivo (ej: "crm-v1-SDD.md")'),
    },
    async ({ artifact_id, destination, filename }) => {
      try {
        const result = await service.exportSdd(artifact_id, destination || 'file', filename);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Error en export_sdd (${artifact_id}):`, err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Error al exportar SDD: ${err.message}` }],
        };
      }
    }
  );

  // Resource 1: artifact://{id}/spec
  server.resource(
    'artifact-spec',
    new ResourceTemplate('artifact://{id}/spec', { list: undefined }),
    async (uri, { id }) => {
      const artifactId = String(id);
      let sdd = service.getGeneratedSdd(artifactId);
      if (!sdd && service.getArtifact(artifactId)) {
        sdd = await service.generateSdd({ artifactId });
      }

      if (!sdd) {
        throw new Error(`No se encontró especificación para el artifact '${artifactId}'`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: sdd,
          },
        ],
      };
    }
  );

  // Resource 2: artifact://{id}/tokens
  server.resource(
    'artifact-tokens',
    new ResourceTemplate('artifact://{id}/tokens', { list: undefined }),
    async (uri, { id }) => {
      const artifactId = String(id);
      const tokens = service.parseTokens(artifactId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(tokens, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
