import { DatabaseSync } from 'node:sqlite';
import { SqlGuard, QueryRejectedError } from './guard.js';
import { ColumnDefinition, DataEntity, DataModel, TableRelationship } from '../types.js';
import { logger } from '../logger.js';
import fs from 'fs';

export class DbClient {
  private sqliteDb: DatabaseSync | null = null;
  private isConnected = false;
  private loadedSchemas = new Set<string>();

  constructor(private dsn?: string) {
    if (dsn) {
      this.initConnection(dsn);
    }
  }

  private initConnection(dsn: string): void {
    try {
      if (dsn.startsWith('sqlite://') || dsn.endsWith('.db') || dsn.endsWith('.sqlite') || dsn === ':memory:') {
        const filePath = dsn.replace(/^sqlite:\/\//, '');
        if (filePath !== ':memory:' && !fs.existsSync(filePath)) {
          logger.warn(`El archivo de base de datos SQLite no existe en '${filePath}'`);
          return;
        }
        this.sqliteDb = new DatabaseSync(filePath);
        this.isConnected = true;
        logger.info(`Conexión SQLite establecida exitosamente con '${filePath}'`);
      } else {
        logger.info(`DSN configurado: ${dsn}. Nota: El motor actual admite sqlite nativo; se usará introspección sqlite.`);
      }
    } catch (err) {
      logger.error('Error al inicializar la conexión con la base de datos:', err);
    }
  }

  /**
   * Sets up an in-memory SQLite database from SQL statements (useful for testing and fixtures).
   */
  loadSchemaSql(sqlStatements: string): void {
    if (this.loadedSchemas.has(sqlStatements)) {
      return;
    }
    if (!this.sqliteDb) {
      this.sqliteDb = new DatabaseSync(':memory:');
      this.isConnected = true;
    }
    // Execution of initial schema in test / setup
    try {
      this.sqliteDb.exec(sqlStatements);
      this.loadedSchemas.add(sqlStatements);
    } catch (err) {
      logger.warn('Advertencia al cargar esquema SQL (posible tabla existente):', err);
    }
  }

  query<T = any>(sql: string): T[] {
    // 1. Double safety check: run through SqlGuard
    SqlGuard.validate(sql);

    if (!this.sqliteDb) {
      throw new Error('No hay una conexión de base de datos activa configurada.');
    }

    const stmt = this.sqliteDb.prepare(sql);
    return stmt.all() as T[];
  }

  hasConnection(): boolean {
    return this.isConnected && this.sqliteDb !== null;
  }

  close(): void {
    if (this.sqliteDb) {
      try {
        this.sqliteDb.close();
      } catch {
        // ignore
      }
      this.sqliteDb = null;
      this.isConnected = false;
    }
  }
}

export class DbIntrospector {
  constructor(private dbClient: DbClient) {}

  /**
   * Introspects the database schema and produces the DataModel with [SRC-DB: table.column] evidence.
   */
  introspectSchema(): DataModel {
    if (!this.dbClient.hasConnection()) {
      return {
        entities: [],
        relationships: [],
      };
    }

    const entities: DataEntity[] = [];
    const relationships: TableRelationship[] = [];

    try {
      // 1. List user tables
      const tablesResult = this.dbClient.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      for (const row of tablesResult) {
        const tableName = row.name;
        const columns: ColumnDefinition[] = [];

        // 2. Fetch table column info via safe PRAGMA
        const columnsInfo = this.dbClient.query<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
          pk: number;
        }>(`PRAGMA table_info('${tableName}')`);

        // 3. Fetch foreign keys via safe PRAGMA
        const foreignKeys = this.dbClient.query<{
          id: number;
          seq: number;
          table: string;
          from: string;
          to: string;
        }>(`PRAGMA foreign_key_list('${tableName}')`);

        const fkMap = new Map<string, { table: string; column: string }>();
        for (const fk of foreignKeys) {
          fkMap.set(fk.from, { table: fk.table, column: fk.to });
          relationships.push({
            fromTable: tableName,
            fromColumn: fk.from,
            toTable: fk.table,
            toColumn: fk.to,
            evidence: `[SRC-DB: ${tableName}.${fk.from} -> ${fk.table}.${fk.to}]`,
          });
        }

        for (const col of columnsInfo) {
          const colEvidence = `[SRC-DB: ${tableName}.${col.name}]`;
          const references = fkMap.get(col.name);

          columns.push({
            name: col.name,
            type: col.type || 'TEXT',
            nullable: col.notnull === 0,
            isPrimaryKey: col.pk === 1,
            references,
            evidence: colEvidence,
          });
        }

        entities.push({
          table: tableName,
          columns,
          relationships: relationships.filter(r => r.fromTable === tableName),
          evidence: `[SRC-DB: ${tableName}]`,
        });
      }
    } catch (err) {
      logger.error('Error durante la introspección de base de datos:', err);
    }

    return {
      entities,
      relationships,
    };
  }
}
