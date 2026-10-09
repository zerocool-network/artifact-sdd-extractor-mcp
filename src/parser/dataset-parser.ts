import { ArtifactFile, ColumnDefinition, DataEntity } from '../types.js';

export interface InferredDataset {
  name: string;
  sourceType: 'file-csv' | 'file-json' | 'code-mock' | 'code-interface';
  columns: ColumnDefinition[];
  sampleCount: number;
}

export class DatasetParser {
  /**
   * Parses CSV string into a DataEntity with inferred types and evidence tags.
   */
  static parseCsv(filename: string, content: string): DataEntity | null {
    const lines = content
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return null;

    // Detect delimiter (comma vs semicolon vs tab)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
    else if (firstLine.includes('\t') && !firstLine.includes(',')) delimiter = '\t';

    const parseRow = (line: string): string[] => {
      // Basic CSV splitter supporting quotes
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(s => s.replace(/^["']|["']$/g, '').trim());
    };

    const headers = parseRow(firstLine);
    if (headers.length === 0 || headers.every(h => h === '')) return null;

    const dataRows = lines.slice(1).map(parseRow);
    const baseName = filename.split(/[/\\]/).pop() || filename;
    const entityName = baseName.replace(/\.[^/.]+$/, '').toLowerCase();

    const columns: ColumnDefinition[] = headers.map((header, colIdx) => {
      const colName = header || `col_${colIdx + 1}`;
      const values = dataRows
        .map(row => row[colIdx])
        .filter(v => v !== undefined && v !== '');

      const inferredType = this.inferTypeFromStrings(values);
      const isPk =
        colName.toLowerCase() === 'id' ||
        colName.toLowerCase() === 'uuid' ||
        colName.toLowerCase() === `${entityName}_id`;

      return {
        name: colName,
        type: inferredType,
        nullable: values.length < dataRows.length,
        isPrimaryKey: isPk,
        evidence: `[SRC-FILE: ${filename}:${colName}]`,
      };
    });

    return {
      table: entityName,
      columns,
      relationships: [],
      evidence: `[SRC-FILE: ${filename}]`,
    };
  }

  /**
   * Parses JSON string (either array of objects or object with arrays) into DataEntity list.
   */
  static parseJson(filename: string, content: string): DataEntity[] {
    const entities: DataEntity[] = [];

    try {
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        const baseName = filename.split(/[/\\]/).pop() || filename;
        const entityName = baseName.replace(/\.[^/.]+$/, '').toLowerCase();
        const entity = this.extractEntityFromObjectArray(entityName, parsed, `[SRC-FILE: ${filename}`);
        if (entity) entities.push(entity);
      } else if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            const entity = this.extractEntityFromObjectArray(key.toLowerCase(), val, `[SRC-FILE: ${filename}`);
            if (entity) entities.push(entity);
          }
        }
      }
    } catch {
      // Invalid JSON, ignore
    }

    return entities;
  }

  /**
   * Extracts mock data arrays embedded in TSX/JS code (e.g. const clients = [...]).
   */
  static parseMockDatasetsFromCode(file: ArtifactFile): DataEntity[] {
    const entities: DataEntity[] = [];
    if (file.path.endsWith('.css')) return entities;

    // Matches: const/let/var variableName = [ { ... }, ... ];
    const arrayDeclRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*(?::\s*[^=]+)?\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])\s*;/g;

    let match: RegExpExecArray | null;
    while ((match = arrayDeclRegex.exec(file.content)) !== null) {
      const varName = match[1];
      const jsonLike = match[2];

      // Ignore trivial or state-related identifiers
      if (/^(initialState|columns|headers|steps|tabs|navItems|menuItems)$/i.test(varName)) {
        continue;
      }

      try {
        // Convert JS object literal string to valid JSON if feasible
        const validJson = jsonLike
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Quote unquoted keys
          .replace(/'([^']*)'/g, '"$1"') // Convert single quotes to double quotes
          .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas

        const parsedArray = JSON.parse(validJson);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          const entity = this.extractEntityFromObjectArray(
            varName.toLowerCase(),
            parsedArray,
            `[SRC-DATA: ${varName}`
          );
          if (entity && entity.columns.length > 0) {
            entities.push(entity);
          }
        }
      } catch {
        // Fallback: regex extraction of keys from the first few object blocks
        const keysFound = new Map<string, string>();
        const propRegex = /([a-zA-Z0-9_]+)\s*:\s*([^,\}\n]+)/g;
        let propMatch: RegExpExecArray | null;
        while ((propMatch = propRegex.exec(jsonLike)) !== null) {
          const k = propMatch[1];
          const rawVal = propMatch[2].trim();
          if (!keysFound.has(k)) {
            let t = 'TEXT';
            if (/^-?\d+$/.test(rawVal)) t = 'INTEGER';
            else if (/^-?\d+\.\d+$/.test(rawVal)) t = 'REAL';
            else if (/^(true|false)$/.test(rawVal)) t = 'BOOLEAN';
            keysFound.set(k, t);
          }
        }

        if (keysFound.size >= 2) {
          const columns: ColumnDefinition[] = Array.from(keysFound.entries()).map(([k, t]) => ({
            name: k,
            type: t,
            nullable: false,
            isPrimaryKey: k.toLowerCase() === 'id',
            evidence: `[SRC-DATA: ${varName}.${k}]`,
          }));
          entities.push({
            table: varName.toLowerCase(),
            columns,
            relationships: [],
            evidence: `[SRC-DATA: ${varName}]`,
          });
        }
      }
    }

    return entities;
  }

  private static extractEntityFromObjectArray(
    name: string,
    items: any[],
    evidencePrefix: string
  ): DataEntity | null {
    if (!items || items.length === 0) return null;

    const columnTypes = new Map<string, Set<string>>();
    const keyPresence = new Map<string, number>();

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;

      for (const [key, val] of Object.entries(item)) {
        if (!columnTypes.has(key)) {
          columnTypes.set(key, new Set<string>());
          keyPresence.set(key, 0);
        }
        keyPresence.set(key, (keyPresence.get(key) || 0) + 1);

        if (val === null || val === undefined) {
          continue;
        }

        if (typeof val === 'number') {
          columnTypes.get(key)!.add(Number.isInteger(val) ? 'INTEGER' : 'REAL');
        } else if (typeof val === 'boolean') {
          columnTypes.get(key)!.add('BOOLEAN');
        } else if (typeof val === 'string') {
          if (!isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/')) && val.length >= 8) {
            columnTypes.get(key)!.add('DATE');
          } else {
            columnTypes.get(key)!.add('TEXT');
          }
        } else if (typeof val === 'object') {
          columnTypes.get(key)!.add('JSON');
        }
      }
    }

    if (columnTypes.size === 0) return null;

    const columns: ColumnDefinition[] = Array.from(columnTypes.entries()).map(([colName, types]) => {
      let resolvedType = 'TEXT';
      if (types.has('JSON')) resolvedType = 'JSON';
      else if (types.has('REAL')) resolvedType = 'REAL';
      else if (types.has('INTEGER')) resolvedType = 'INTEGER';
      else if (types.has('DATE')) resolvedType = 'DATE';
      else if (types.has('BOOLEAN')) resolvedType = 'BOOLEAN';

      const presence = keyPresence.get(colName) || 0;
      const isPk =
        colName.toLowerCase() === 'id' ||
        colName.toLowerCase() === 'uuid' ||
        colName.toLowerCase() === `${name}_id`;

      const ev = evidencePrefix.startsWith('[SRC-DATA:')
        ? `${evidencePrefix}.${colName}]`
        : `${evidencePrefix}:${colName}]`;

      return {
        name: colName,
        type: resolvedType,
        nullable: presence < items.length,
        isPrimaryKey: isPk,
        evidence: ev,
      };
    });

    return {
      table: name,
      columns,
      relationships: [],
      evidence: evidencePrefix.includes('SRC-FILE')
        ? `${evidencePrefix}]`
        : `[SRC-DATA: ${name}]`,
    };
  }

  private static inferTypeFromStrings(values: string[]): string {
    if (values.length === 0) return 'TEXT';

    const isAllInt = values.every(v => /^-?\d+$/.test(v));
    if (isAllInt) return 'INTEGER';

    const isAllReal = values.every(v => /^-?\d+(\.\d+)?$/.test(v));
    if (isAllReal) return 'REAL';

    const isAllBool = values.every(v => /^(true|false|0|1|si|no|yes)$/i.test(v));
    if (isAllBool) return 'BOOLEAN';

    const isAllDate = values.every(v => {
      const parsed = Date.parse(v);
      return !isNaN(parsed) && (v.includes('-') || v.includes('/')) && v.length >= 8;
    });
    if (isAllDate) return 'DATE';

    return 'TEXT';
  }
}
