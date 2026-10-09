import { DatabaseSync } from 'node:sqlite';
import mysql, { Pool } from 'mysql2/promise';
import { SqlGuard } from './guard.js';
import { ColumnDefinition, DataEntity, DataModel, TableRelationship } from '../types.js';
import { logger } from '../logger.js';
import fs from 'fs';

export class DbClient {
  private sqliteDb: DatabaseSync | null = null;
  private mysqlPool: Pool | null = null;
  private dbType: 'sqlite' | 'mysql' | 'none' = 'none';
  private isConnected = false;
  private loadedSchemas = new Set<string>();
  private mysqlDatabaseName = '';

  constructor(private dsn?: string) {
    if (dsn) {
      this.initConnection(dsn);
    }
  }

  private initConnection(dsn: string): void {
    try {
      if (dsn.startsWith('mysql://') || dsn.startsWith('mysql2://')) {
        this.dbType = 'mysql';
        const url = new URL(dsn);
        this.mysqlDatabaseName = url.pathname.replace(/^\//, '');

        this.mysqlPool = mysql.createPool({
          host: url.hostname || 'localhost',
          port: url.port ? parseInt(url.port, 10) : 3306,
          user: url.username || 'root',
          password: url.password || '',
          database: this.mysqlDatabaseName,
          waitForConnections: true,
          connectionLimit: 5,
          connectTimeout: 5000,
        });

        this.isConnected = true;
        logger.info(`Conexión MySQL configurada para '${url.hostname}:${url.port || 3306}/${this.mysqlDatabaseName}'`);
      } else if (dsn.startsWith('sqlite://') || dsn.endsWith('.db') || dsn.endsWith('.sqlite') || dsn === ':memory:') {
        this.dbType = 'sqlite';
        const filePath = dsn.replace(/^sqlite:\/\//, '');
        if (filePath !== ':memory:' && !fs.existsSync(filePath)) {
          logger.warn(`El archivo de base de datos SQLite no existe en '${filePath}'`);
          return;
        }
        this.sqliteDb = new DatabaseSync(filePath);
        this.isConnected = true;
        logger.info(`Conexión SQLite establecida exitosamente con '${filePath}'`);
      } else {
        logger.info(`DSN configurado no reconocido como sqlite o mysql: ${dsn}`);
      }
    } catch (err) {
      logger.error('Error al inicializar la conexión con la base de datos:', err);
    }
  }

  getDbType(): 'sqlite' | 'mysql' | 'none' {
    return this.dbType;
  }

  getMysqlDatabaseName(): string {
    return this.mysqlDatabaseName;
  }

  /**
   * Sets up an in-memory SQLite database from SQL statements (useful for testing, fixtures, and local SQL files).
   */
  loadSchemaSql(sqlStatements: string): void {
    if (this.loadedSchemas.has(sqlStatements)) {
      return;
    }

    // Try adapting MySQL DDL syntax to SQLite if necessary
    const normalizedSql = this.adaptMysqlToSqlite(sqlStatements);

    if (!this.sqliteDb) {
      this.sqliteDb = new DatabaseSync(':memory:');
      this.dbType = 'sqlite';
      this.isConnected = true;
    }

    try {
      this.sqliteDb.exec(normalizedSql);
      this.loadedSchemas.add(sqlStatements);
    } catch (err) {
      logger.warn('Advertencia al cargar esquema SQL en motor local:', err);
    }
  }

  private adaptMysqlToSqlite(sql: string): string {
    return sql
      .replace(/ENGINE\s*=\s*[a-zA-Z0-9_]+/gi, '')
      .replace(/DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+/gi, '')
      .replace(/COLLATE\s*=\s*[a-zA-Z0-9_]+/gi, '')
      .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
      .replace(/KEY\s+`?[a-zA-Z0-9_]+`?\s*\([^)]*\),?/gi, '')
      .replace(/`([a-zA-Z0-9_]+)`/g, '$1');
  }

  query<T = any>(sql: string): T[] {
    SqlGuard.validate(sql);

    if (!this.sqliteDb) {
      throw new Error('No hay una conexión de base de datos activa configurada.');
    }

    const stmt = this.sqliteDb.prepare(sql);
    return stmt.all() as T[];
  }

  async queryMysql<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    SqlGuard.validate(sql);

    if (!this.mysqlPool) {
      throw new Error('No hay un pool de conexión MySQL configurado.');
    }

    const [rows] = await this.mysqlPool.query(sql, params);
    return rows as T[];
  }

  hasConnection(): boolean {
    return this.isConnected && (this.sqliteDb !== null || this.mysqlPool !== null);
  }

  async close(): Promise<void> {
    if (this.sqliteDb) {
      try {
        this.sqliteDb.close();
      } catch {
        // ignore
      }
      this.sqliteDb = null;
    }
    if (this.mysqlPool) {
      try {
        await this.mysqlPool.end();
      } catch {
        // ignore
      }
      this.mysqlPool = null;
    }
    this.isConnected = false;
    this.dbType = 'none';
  }
}

export class DbIntrospector {
  constructor(private dbClient: DbClient) {}

  /**
   * Introspects the database schema and produces the DataModel with [SRC-DB: table.column] evidence.
   * Supports active MySQL servers, SQLite databases, and parsed MySQL DDL scripts.
   */
  async introspectSchema(): Promise<DataModel> {
    if (!this.dbClient.hasConnection()) {
      return { entities: [], relationships: [] };
    }

    if (this.dbClient.getDbType() === 'mysql') {
      return this.introspectMysql();
    }

    return this.introspectSqlite();
  }

  /**
   * Introspects live MySQL database using information_schema tables.
   */
  private async introspectMysql(): Promise<DataModel> {
    const entities: DataEntity[] = [];
    const relationships: TableRelationship[] = [];
    const dbName = this.dbClient.getMysqlDatabaseName();

    try {
      // 1. Get MySQL Tables
      const tablesSql = `
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const tables = await this.dbClient.queryMysql<{ name: string }>(tablesSql, [dbName]);

      // 2. Get MySQL Columns
      const columnsSql = `
        SELECT 
          table_name,
          column_name,
          data_type,
          column_type,
          is_nullable,
          column_key
        FROM information_schema.columns
        WHERE table_schema = ?
        ORDER BY table_name, ordinal_position;
      `;
      const allColumns = await this.dbClient.queryMysql<{
        table_name: string;
        column_name: string;
        data_type: string;
        column_type: string;
        is_nullable: string;
        column_key: string;
      }>(columnsSql, [dbName]);

      // 3. Get MySQL Foreign Keys
      const fkSql = `
        SELECT
          table_name AS fromTable,
          column_name AS fromColumn,
          referenced_table_name AS toTable,
          referenced_column_name AS toColumn
        FROM information_schema.key_column_usage
        WHERE table_schema = ?
          AND referenced_table_name IS NOT NULL;
      `;
      const fkRows = await this.dbClient.queryMysql<{
        fromTable: string;
        fromColumn: string;
        toTable: string;
        toColumn: string;
      }>(fkSql, [dbName]);

      const fkMap = new Map<string, { table: string; column: string }>();
      for (const fk of fkRows) {
        fkMap.set(`${fk.fromTable}.${fk.fromColumn}`, { table: fk.toTable, column: fk.toColumn });
        relationships.push({
          fromTable: fk.fromTable,
          fromColumn: fk.fromColumn,
          toTable: fk.toTable,
          toColumn: fk.toColumn,
          evidence: `[SRC-DB: ${fk.fromTable}.${fk.fromColumn} -> ${fk.toTable}.${fk.toColumn}]`,
        });
      }

      for (const tableRow of tables) {
        const tableName = tableRow.name;
        const tableCols = allColumns.filter(c => c.table_name === tableName);
        const columns: ColumnDefinition[] = [];

        for (const col of tableCols) {
          const ref = fkMap.get(`${tableName}.${col.column_name}`);
          columns.push({
            name: col.column_name,
            type: col.column_type || col.data_type.toUpperCase(),
            nullable: col.is_nullable === 'YES',
            isPrimaryKey: col.column_key === 'PRI',
            references: ref,
            evidence: `[SRC-DB: ${tableName}.${col.column_name}]`,
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
      logger.error('Error durante la introspección de MySQL:', err);
    }

    return { entities, relationships };
  }

  /**
   * Introspects local SQLite database.
   */
  private introspectSqlite(): DataModel {
    const entities: DataEntity[] = [];
    const relationships: TableRelationship[] = [];

    try {
      const tablesResult = this.dbClient.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      for (const row of tablesResult) {
        const tableName = row.name;
        const columns: ColumnDefinition[] = [];

        const columnsInfo = this.dbClient.query<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
          pk: number;
        }>(`PRAGMA table_info('${tableName}')`);

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
      logger.error('Error durante la introspección de SQLite:', err);
    }

    return { entities, relationships };
  }

  /**
   * Static helper to parse MySQL DDL syntax directly (for offline schema files).
   */
  static parseMysqlDdl(ddlContent: string): DataModel {
    const entities: DataEntity[] = [];
    const relationships: TableRelationship[] = [];

    const tableBlocks = ddlContent.split(/CREATE\s+TABLE/i).slice(1);

    for (const block of tableBlocks) {
      const nameMatch = block.match(/^\s*(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s*\(/i);
      if (!nameMatch) continue;

      const tableName = nameMatch[1];
      const columns: ColumnDefinition[] = [];

      // Extract lines inside parentheses
      const body = block.substring(block.indexOf('(') + 1, block.lastIndexOf(')'));
      const lines = body.split(/\r?\n/).map(l => l.trim().replace(/,$/, ''));

      const pkColumns = new Set<string>();
      const fkList: Array<{ from: string; toTable: string; toColumn: string }> = [];

      // Pass 1: find constraints (PRIMARY KEY, FOREIGN KEY)
      for (const line of lines) {
        const pkMatch = line.match(/^PRIMARY\s+KEY\s*\(`?([a-zA-Z0-9_]+)`?\)/i);
        if (pkMatch) {
          pkColumns.add(pkMatch[1]);
        }
        const fkMatch = line.match(/FOREIGN\s+KEY\s*\(`?([a-zA-Z0-9_]+)`?\)\s*REFERENCES\s*`?([a-zA-Z0-9_]+)`?\s*\(`?([a-zA-Z0-9_]+)`?\)/i);
        if (fkMatch) {
          fkList.push({ from: fkMatch[1], toTable: fkMatch[2], toColumn: fkMatch[3] });
        }
      }

      // Pass 2: parse columns
      for (const line of lines) {
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|KEY|INDEX|CONSTRAINT|UNIQUE)/i.test(line)) continue;

        const colMatch = line.match(/^`?([a-zA-Z0-9_]+)`?\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)\s*(.*)/i);
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2];
          const rest = colMatch[3] || '';

          const isPk = pkColumns.has(colName) || rest.includes('PRIMARY KEY');
          const isNullable = !rest.includes('NOT NULL');
          const fk = fkList.find(f => f.from === colName);

          const colDef: ColumnDefinition = {
            name: colName,
            type: colType.toUpperCase(),
            nullable: isNullable,
            isPrimaryKey: isPk,
            references: fk ? { table: fk.toTable, column: fk.toColumn } : undefined,
            evidence: `[SRC-DB: ${tableName}.${colName}]`,
          };
          columns.push(colDef);
        }
      }

      for (const fk of fkList) {
        relationships.push({
          fromTable: tableName,
          fromColumn: fk.from,
          toTable: fk.toTable,
          toColumn: fk.toColumn,
          evidence: `[SRC-DB: ${tableName}.${fk.from} -> ${fk.toTable}.${fk.toColumn}]`,
        });
      }

      entities.push({
        table: tableName,
        columns,
        relationships: relationships.filter(r => r.fromTable === tableName),
        evidence: `[SRC-DB: ${tableName}]`,
      });
    }

    return { entities, relationships };
  }
}
