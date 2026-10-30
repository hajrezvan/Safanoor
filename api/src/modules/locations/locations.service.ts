import { Injectable } from '@nestjs/common';
import { normalizePersian } from '@safanoor/shared';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  CreateLocationDto,
  LocationOptionDto,
  LocationQueryDto,
  LocationsPageDto,
} from './locations.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: Actor,
    query: LocationQueryDto,
  ): Promise<LocationsPageDto> {
    await this.access.require(actor, 'read', { type: 'location_option' });
    const search = normalizePersian(query.search?.trim() ?? '');
    const pattern = search ? `%${search}%` : null;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*)::text AS count FROM location_option
       WHERE active=true
         AND ($1::text IS NULL OR label_normalized LIKE $1)`,
      [pattern],
    );
    const items = await rows<LocationOptionDto>(
      this.db,
      `SELECT id,label,active FROM location_option
       WHERE active=true
         AND ($1::text IS NULL OR label_normalized LIKE $1)
       ORDER BY label,id
       LIMIT $2 OFFSET $3`,
      [pattern, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async create(
    actor: Actor,
    input: CreateLocationDto,
  ): Promise<LocationOptionDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'location_option' },
      'detail',
    );
    return this.upsert(actor.personId, input.label);
  }

  async upsert(
    createdBy: string | null,
    label: string,
  ): Promise<LocationOptionDto> {
    const trimmed = label.trim();
    const normalized = normalizePersian(trimmed);
    const existing = await one<LocationOptionDto>(
      this.db,
      `SELECT id,label,active FROM location_option
       WHERE label_normalized=$1
       ORDER BY active DESC, created_at DESC
       LIMIT 1`,
      [normalized],
    );
    if (existing?.active) return existing;
    if (existing && !existing.active) {
      const reactivated = await one<LocationOptionDto>(
        this.db,
        `UPDATE location_option
         SET active=true,label=$2,updated_at=now()
         WHERE id=$1
         RETURNING id,label,active`,
        [existing.id, trimmed],
      );
      if (reactivated) return reactivated;
    }
    const created = await one<LocationOptionDto>(
      this.db,
      `INSERT INTO location_option(label,label_normalized,created_by)
       VALUES($1,$2,$3)
       RETURNING id,label,active`,
      [trimmed, normalized, createdBy],
    );
    if (!created) throw new Error('location_option upsert failed');
    if (createdBy)
      await this.audit.record(
        createdBy,
        'location_option.created',
        'location_option',
        created.id,
        {},
      );
    return created;
  }
}
