import { Defaults1792195200003 } from './migrations/1792195200003-Defaults';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Foundation1792195200000 } from './migrations/1792195200000-Foundation';
import { Invariants1792195200001 } from './migrations/1792195200001-Invariants';

import { PolicySeed1792195200002 } from './migrations/1792195200002-PolicySeed';

config();
export const databaseOptions = {
  type: 'postgres' as const,
  url:
    process.env.DATABASE_URL ??
    'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor',
  synchronize: false,
  migrations: [
    Foundation1792195200000,
    Invariants1792195200001,
    PolicySeed1792195200002,
    Defaults1792195200003,
  ],
  logging: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
};
export default new DataSource(databaseOptions);
