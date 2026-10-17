import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Database, rows } from '../../libs/database/database.types';

@Injectable()
export class AuditService {
  constructor(private readonly db: DataSource) {}
  async record(
    actorId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    meta: Record<string, string | number | boolean | null> = {},
    transaction: Database = this.db,
  ): Promise<void> {
    const permitted = new Set([
      'count',
      'version',
      'reasonCode',
      'fieldCount',
      'status',
      'level',
      'importId',
    ]);
    const safe = Object.fromEntries(
      Object.entries(meta).filter(([key]) => permitted.has(key)),
    );
    await rows(
      transaction,
      'INSERT INTO audit_log(actor_id,action,resource_type,resource_id,meta) VALUES($1,$2,$3,$4,$5)',
      [actorId, action, resourceType, resourceId, JSON.stringify(safe)],
    );
  }
}
