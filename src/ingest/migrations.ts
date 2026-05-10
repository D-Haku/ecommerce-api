// Apply SQL migration files against a MySQL pool in lexical order.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Pool } from 'mysql2/promise';

function splitSqlStatements(sql: string): string[] {
  // Simple splitter that handles semicolon-terminated DDL statements.
  // Comments are stripped before splitting.
  const stripped = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runMigrations(
  pool: Pool,
  migrationsDir: string = path.resolve(process.cwd(), 'migrations'),
): Promise<string[]> {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = await fs.readFile(full, 'utf8');
    const statements = splitSqlStatements(sql);
    const conn = await pool.getConnection();
    try {
      for (const statement of statements) {
        await conn.query(statement);
      }
      applied.push(file);
    } finally {
      conn.release();
    }
  }
  return applied;
}
