export class QueryRejectedError extends Error {
  constructor(reason: string) {
    super(`Consulta SQL rechazada por política de seguridad de solo lectura: ${reason}. Code: QUERY_REJECTED`);
    this.name = 'QueryRejectedError';
  }
}

export class SqlGuard {
  private static readonly FORBIDDEN_KEYWORDS = [
    'DROP',
    'ALTER',
    'TRUNCATE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'REPLACE',
    'GRANT',
    'REVOKE',
    'ATTACH',
    'DETACH',
    'EXEC',
    'EXECUTE',
    'CALL',
  ];

  /**
   * Validates that an SQL query is strictly read-only.
   * Throws QueryRejectedError if any write or DDL operation is detected.
   */
  static validate(sql: string): void {
    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      throw new QueryRejectedError('La consulta SQL no puede estar vacía');
    }

    // Strip comments (-- comment and /* comment */)
    const cleanedSql = sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    // Check for multiple statements separated by semicolon
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (statements.length > 1) {
      throw new QueryRejectedError('No se permiten múltiples declaraciones SQL en una sola ejecución');
    }

    const singleStatement = statements[0];
    const upper = singleStatement.toUpperCase();

    // Must start with SELECT, WITH (for CTEs), or safe PRAGMA (for SQLite introspection)
    const validStart =
      upper.startsWith('SELECT') ||
      upper.startsWith('WITH') ||
      upper.startsWith('PRAGMA TABLE_INFO') ||
      upper.startsWith('PRAGMA FOREIGN_KEY_LIST') ||
      upper.startsWith('PRAGMA TABLE_LIST');

    if (!validStart) {
      throw new QueryRejectedError(`La sentencia debe comenzar con SELECT, WITH o PRAGMA read-only. Inicia con: '${singleStatement.substring(0, 15)}'`);
    }

    // Check for forbidden keywords anywhere as word tokens
    for (const keyword of this.FORBIDDEN_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(singleStatement)) {
        throw new QueryRejectedError(`Palabra clave prohibida '${keyword}' detectada en consulta`);
      }
    }
  }
}
