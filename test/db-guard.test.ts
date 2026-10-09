import { describe, it, expect } from 'vitest';
import { SqlGuard, QueryRejectedError } from '../src/db/guard.js';

describe('SqlGuard (Seguridad Read-Only / NFR-3)', () => {
  it('debe permitir sentencias SELECT válidas', () => {
    expect(() => SqlGuard.validate('SELECT * FROM users')).not.toThrow();
    expect(() => SqlGuard.validate('SELECT id, name FROM customers WHERE id = 1')).not.toThrow();
    expect(() => SqlGuard.validate('WITH recent AS (SELECT * FROM orders) SELECT * FROM recent')).not.toThrow();
  });

  it('debe permitir sentencias PRAGMA de introspección de solo lectura', () => {
    expect(() => SqlGuard.validate("PRAGMA table_info('customers')")).not.toThrow();
    expect(() => SqlGuard.validate("PRAGMA foreign_key_list('orders')")).not.toThrow();
  });

  it('debe rechazar sentencias destructivas DDL y DML con QueryRejectedError', () => {
    expect(() => SqlGuard.validate('DROP TABLE users')).toThrow(QueryRejectedError);
    expect(() => SqlGuard.validate('TRUNCATE TABLE orders')).toThrow(QueryRejectedError);
    expect(() => SqlGuard.validate('DELETE FROM customers WHERE id = 1')).toThrow(QueryRejectedError);
    expect(() => SqlGuard.validate("INSERT INTO users (name) VALUES ('hacker')")).toThrow(QueryRejectedError);
    expect(() => SqlGuard.validate("UPDATE users SET name = 'admin'")).toThrow(QueryRejectedError);
    expect(() => SqlGuard.validate('ALTER TABLE users ADD COLUMN role text')).toThrow(QueryRejectedError);
  });

  it('debe rechazar inyecciones con múltiples sentencias separadas por punto y coma', () => {
    expect(() => SqlGuard.validate('SELECT * FROM users; DROP TABLE users;')).toThrow(QueryRejectedError);
  });
});
