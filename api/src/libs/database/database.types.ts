import type { DataSource, EntityManager } from 'typeorm';

export type Database = DataSource | EntityManager;
export async function rows<T>(
  db: Database,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  return db.query<T[]>(sql, parameters);
}
export async function one<T>(
  db: Database,
  sql: string,
  parameters: unknown[] = [],
): Promise<T | undefined> {
  return (await rows<T>(db, sql, parameters))[0];
}
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
export function pageOf<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Page<T> {
  return { items, page, limit, total };
}
