import fs from 'fs';
import path from 'path';
import { ArtifactStore, defaultArtifactStore } from './store/artifact-store.js';
import { CssTokenParser, defaultCssTokenParser } from './parser/css-parser.js';
import { ComponentParser, defaultComponentParser } from './parser/component-parser.js';
import { LayoutParser, defaultLayoutParser } from './parser/layout-parser.js';
import { DbClient, DbIntrospector } from './db/client.js';
import { SddEngine, defaultSddEngine } from './sdd/engine.js';
import {
  ArtifactFile,
  DataModel,
  DataEntity,
  TableRelationship,
  ColumnDefinition,
  DesignFacts,
  DesignToken,
  ComponentItem,
  LayoutStructure,
  IngestedArtifact,
  SDDGenerationOptions,
} from './types.js';
import { config } from './config.js';
import { logger } from './logger.js';

export class ArtifactSddService {
  private generatedSdds: Map<string, string> = new Map();
  private dbClients: Map<string, DbClient> = new Map();

  constructor(
    private store: ArtifactStore = defaultArtifactStore,
    private tokenParser: CssTokenParser = defaultCssTokenParser,
    private componentParser: ComponentParser = defaultComponentParser,
    private layoutParser: LayoutParser = defaultLayoutParser,
    private sddEngine: SddEngine = defaultSddEngine
  ) {}

  ingestArtifact(artifactId: string, rawFiles: ArtifactFile[] | string): IngestedArtifact {
    return this.store.ingest(artifactId, rawFiles);
  }

  getArtifact(artifactId: string): IngestedArtifact {
    return this.store.getArtifact(artifactId);
  }

  parseTokens(artifactId: string): DesignToken[] {
    const files = this.store.getSource(artifactId);
    return this.tokenParser.extractTokens(files);
  }

  extractComponents(artifactId: string): ComponentItem[] {
    const files = this.store.getSource(artifactId);
    return this.componentParser.extractComponents(files);
  }

  extractLayout(artifactId: string, screen: string = 'Main'): LayoutStructure {
    const files = this.store.getSource(artifactId);
    return this.layoutParser.extractLayout(files, screen);
  }

  getOrCreateDbClient(artifactId: string, dsn?: string, schemaSql?: string): DbClient {
    let client = this.dbClients.get(artifactId);
    if (!client) {
      const targetDsn = dsn || config.dbDsn;
      client = new DbClient(targetDsn);
      this.dbClients.set(artifactId, client);
    }

    if (schemaSql) {
      client.loadSchemaSql(schemaSql);
    }

    return client;
  }

  async extractDataModel(
    artifactId: string,
    options?: {
      schemaSql?: string;
      dbDsn?: string;
      entities?: DataEntity[];
      relationships?: TableRelationship[];
    }
  ): Promise<DataModel> {
    // 1. If entities were passed directly by Claude (e.g. from Tabularis or conversation context)
    if (options?.entities && options.entities.length > 0) {
      return {
        entities: options.entities,
        relationships: options.relationships || [],
      };
    }

    // 2. If schema.sql was ingested inside the artifact files, load it automatically into db
    if (this.store.hasArtifact(artifactId)) {
      const files = this.store.getSource(artifactId);
      const sqlFile = files.find(f => f.path.endsWith('.sql'));
      if (sqlFile && !options?.schemaSql) {
        options = { ...options, schemaSql: sqlFile.content };
      }
    }

    // 3. Check if offline MySQL DDL is provided
    if (options?.schemaSql && (options.schemaSql.includes('ENGINE=') || options.schemaSql.includes('AUTO_INCREMENT'))) {
      const parsed = DbIntrospector.parseMysqlDdl(options.schemaSql);
      if (parsed.entities.length > 0) {
        return parsed;
      }
    }

    // 4. If a live database or schemaSql was configured, introspect it
    if (options?.dbDsn || config.dbDsn || options?.schemaSql) {
      try {
        const client = this.getOrCreateDbClient(artifactId, options?.dbDsn, options?.schemaSql);
        if (client.hasConnection()) {
          const introspector = new DbIntrospector(client);
          const result = await introspector.introspectSchema();
          if (result.entities.length > 0) {
            return result;
          }
        }
      } catch (err) {
        logger.warn('Introspección de BD externa omitida:', err);
      }
    }

    // 5. Fallback sin BD externa: Extraer entidades de datos directamente de las interfaces TypeScript del artifact
    if (this.store.hasArtifact(artifactId)) {
      const files = this.store.getSource(artifactId);
      const codeEntities = this.extractEntitiesFromArtifactCode(files);
      if (codeEntities.length > 0) {
        return {
          entities: codeEntities,
          relationships: [],
        };
      }
    }

    return { entities: [], relationships: [] };
  }

  private extractEntitiesFromArtifactCode(files: ArtifactFile[]): DataEntity[] {
    const entities: DataEntity[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      if (file.path.endsWith('.css')) continue;

      const interfaceRegex = /(?:export\s+)?(?:interface|type)\s+([A-Z][a-zA-Z0-9_]*)(?:Props)?\s*(?:=\s*)?{([^}]+)}/g;

      let match: RegExpExecArray | null;
      while ((match = interfaceRegex.exec(file.content)) !== null) {
        const rawName = match[1];
        if (rawName.endsWith('Props') || rawName === 'Props' || rawName === 'State') continue;

        const tableName = rawName.toLowerCase();
        if (seen.has(tableName)) continue;
        seen.add(tableName);

        const body = match[2];
        const colLines = body.split(/[;\n]/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));

        const columns: ColumnDefinition[] = [];
        for (const line of colLines) {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const colName = parts[0].replace('?', '').trim();
            const colType = parts.slice(1).join(':').trim().replace(/[,;]/g, '');

            if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(colName)) {
              columns.push({
                name: colName,
                type: colType.toUpperCase() || 'TEXT',
                nullable: parts[0].includes('?'),
                isPrimaryKey: colName.toLowerCase() === 'id',
                evidence: `[SRC-DB: ${tableName}.${colName}]`,
              });
            }
          }
        }

        if (columns.length > 0) {
          entities.push({
            table: tableName,
            columns,
            relationships: [],
            evidence: `[SRC-DB: ${tableName}]`,
          });
        }
      }
    }

    return entities;
  }

  async generateSdd(options: SDDGenerationOptions): Promise<string> {
    const { artifactId } = options;
    const tokens = this.parseTokens(artifactId);
    const components = this.extractComponents(artifactId);
    const layout = this.extractLayout(artifactId);

    const dataModel =
      options.dataModel ||
      (options.entities
        ? { entities: options.entities, relationships: [] }
        : await this.extractDataModel(artifactId));

    const designFacts: DesignFacts = {
      artifactId,
      tokens,
      components,
      layout,
      businessRules: [],
    };

    const sdd = this.sddEngine.render(designFacts, dataModel, options);
    this.generatedSdds.set(artifactId, sdd);
    return sdd;
  }

  getGeneratedSdd(artifactId: string): string | undefined {
    return this.generatedSdds.get(artifactId);
  }

  async exportSdd(artifactId: string, destination: 'file' | 'inline' = 'file', filename?: string): Promise<{ destination: string; content?: string; path?: string }> {
    let sdd = this.generatedSdds.get(artifactId);
    if (!sdd) {
      // Auto-generate if not yet produced
      sdd = await this.generateSdd({ artifactId });
    }

    if (destination === 'inline') {
      return {
        destination: 'inline',
        content: sdd,
      };
    }

    const outDir = config.exportDir;
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const safeName = filename || `${artifactId}-SDD.md`;
    const targetPath = path.resolve(outDir, safeName);
    fs.writeFileSync(targetPath, sdd, 'utf-8');

    logger.info(`SDD exportado a archivo: ${targetPath}`);

    return {
      destination: 'file',
      path: targetPath,
    };
  }
}

export const defaultArtifactService = new ArtifactSddService();
