import fs from 'fs';
import path from 'path';
import { ArtifactStore, defaultArtifactStore } from './store/artifact-store.js';
import { CssTokenParser, defaultCssTokenParser } from './parser/css-parser.js';
import { ComponentParser, defaultComponentParser } from './parser/component-parser.js';
import { LayoutParser, defaultLayoutParser } from './parser/layout-parser.js';
import { DbClient, DbIntrospector } from './db/client.js';
import { DatasetParser } from './parser/dataset-parser.js';
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
    // 1. If entities were passed directly by Claude (e.g. from Tabularis, APIs, or conversation context)
    if (options?.entities && options.entities.length > 0) {
      return {
        entities: options.entities,
        relationships: options.relationships || [],
      };
    }

    const discoveredEntities: DataEntity[] = [];
    const discoveredRelationships: TableRelationship[] = [...(options?.relationships || [])];

    // 2. Extract from ingested files if present (CSV, JSON, SQL)
    if (this.store.hasArtifact(artifactId)) {
      const files = this.store.getSource(artifactId);

      // 2.1 CSV Files (e.g. exported from Excel, spreadsheet uploads)
      for (const file of files) {
        if (file.path.endsWith('.csv')) {
          const csvEntity = DatasetParser.parseCsv(file.path, file.content);
          if (csvEntity) discoveredEntities.push(csvEntity);
        }
      }

      // 2.2 JSON Files (data exports, JSON payloads)
      for (const file of files) {
        if (file.path.endsWith('.json') && !file.path.includes('package.json') && !file.path.includes('tsconfig')) {
          const jsonEntities = DatasetParser.parseJson(file.path, file.content);
          discoveredEntities.push(...jsonEntities);
        }
      }

      // 2.3 SQL Files inside the artifact
      const sqlFile = files.find(f => f.path.endsWith('.sql'));
      if (sqlFile && !options?.schemaSql) {
        options = { ...options, schemaSql: sqlFile.content };
      }
    }

    // 3. Check if offline MySQL DDL is provided
    if (options?.schemaSql && (options.schemaSql.includes('ENGINE=') || options.schemaSql.includes('AUTO_INCREMENT'))) {
      const parsed = DbIntrospector.parseMysqlDdl(options.schemaSql);
      if (parsed.entities.length > 0) {
        discoveredEntities.push(...parsed.entities);
        discoveredRelationships.push(...parsed.relationships);
      }
    }

    // 4. If a live database or schemaSql was configured, introspect it
    if ((options?.dbDsn || config.dbDsn || options?.schemaSql) && discoveredEntities.length === 0) {
      try {
        const client = this.getOrCreateDbClient(artifactId, options?.dbDsn, options?.schemaSql);
        if (client.hasConnection()) {
          const introspector = new DbIntrospector(client);
          const result = await introspector.introspectSchema();
          if (result.entities.length > 0) {
            discoveredEntities.push(...result.entities);
            discoveredRelationships.push(...result.relationships);
          }
        }
      } catch (err) {
        logger.warn('Introspección de BD externa omitida:', err);
      }
    }

    // 5. Datasets and mock data arrays embedded in code (e.g. const sales = [...])
    if (this.store.hasArtifact(artifactId)) {
      const files = this.store.getSource(artifactId);
      for (const file of files) {
        const mockEntities = DatasetParser.parseMockDatasetsFromCode(file);
        for (const me of mockEntities) {
          if (!discoveredEntities.some(e => e.table === me.table)) {
            discoveredEntities.push(me);
          }
        }
      }

      // 6. TypeScript interfaces / types in code
      const codeEntities = this.extractEntitiesFromArtifactCode(files);
      for (const ce of codeEntities) {
        if (!discoveredEntities.some(e => e.table === ce.table)) {
          discoveredEntities.push(ce);
        }
      }
    }

    // Deduplicate entities by table name
    const uniqueEntities: DataEntity[] = [];
    const seen = new Set<string>();
    for (const ent of discoveredEntities) {
      if (!seen.has(ent.table)) {
        seen.add(ent.table);
        uniqueEntities.push(ent);
      }
    }

    return {
      entities: uniqueEntities,
      relationships: discoveredRelationships,
    };
  }

  private extractEntitiesFromArtifactCode(files: ArtifactFile[]): DataEntity[] {
    const entities: DataEntity[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      if (file.path.endsWith('.css') || file.path.endsWith('.json') || file.path.endsWith('.csv')) continue;

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
                evidence: `[SRC-CODE: ${file.path}:${colName}]`,
              });
            }
          }
        }

        if (columns.length > 0) {
          entities.push({
            table: tableName,
            columns,
            relationships: [],
            evidence: `[SRC-CODE: ${file.path}:${tableName}]`,
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
