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

  extractDataModel(artifactId: string, options?: { schemaSql?: string; dbDsn?: string }): DataModel {
    // If schema.sql was ingested inside the artifact files, load it automatically into db
    if (this.store.hasArtifact(artifactId)) {
      const files = this.store.getSource(artifactId);
      const sqlFile = files.find(f => f.path.endsWith('.sql'));
      if (sqlFile && !options?.schemaSql) {
        options = { ...options, schemaSql: sqlFile.content };
      }
    }

    const client = this.getOrCreateDbClient(artifactId, options?.dbDsn, options?.schemaSql);
    const introspector = new DbIntrospector(client);
    return introspector.introspectSchema();
  }

  generateSdd(options: SDDGenerationOptions): string {
    const { artifactId } = options;
    const tokens = this.parseTokens(artifactId);
    const components = this.extractComponents(artifactId);
    const layout = this.extractLayout(artifactId);
    const dataModel = this.extractDataModel(artifactId);

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

  exportSdd(artifactId: string, destination: 'file' | 'inline' = 'file', filename?: string): { destination: string; content?: string; path?: string } {
    let sdd = this.generatedSdds.get(artifactId);
    if (!sdd) {
      // Auto-generate if not yet produced
      sdd = this.generateSdd({ artifactId });
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
