import { Injectable } from '@nestjs/common';
import { normalizePersian } from '@safanoor/shared';
import { DataSource } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { AccessService } from '../access/access.service';
import {
  DirectorMetricDto,
  DirectorPeoplePageDto,
  DirectorPersonDto,
  DirectorSummaryDto,
} from './director.dto';

@Injectable()
export class DirectorService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
  ) {}

  async summary(actor: Actor): Promise<DirectorSummaryDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'organization_report' },
      'detail',
    );
    // Explicit aggregates only: no content, contacts, identity fields, files or private notes.
    const metrics = await rows<DirectorMetricDto>(
      this.db,
      `
      SELECT 'people' AS key,count(*)::int AS count FROM person WHERE status='active' AND NOT external
      UNION ALL SELECT 'groups',count(*)::int FROM organization_group
      UNION ALL SELECT 'mentor',count(DISTINCT owner_person_id)::int FROM organization_group
      UNION ALL SELECT 'assistant',count(DISTINCT m.person_id)::int FROM membership m JOIN person p ON p.id=m.person_id WHERE m.role='assistant' AND m.valid_to IS NULL AND p.status='active'
      UNION ALL SELECT 'consultations',count(*)::int FROM consultation
      UNION ALL SELECT 'meetings',count(*)::int FROM meeting
      UNION ALL SELECT 'library',count(*)::int FROM study_path
      UNION ALL SELECT 'reportBooks',count(*)::int FROM study_path_item
      UNION ALL SELECT 'reportCompletedBooks',count(*)::int FROM study_path_reading r JOIN person p ON p.id=r.person_id WHERE r.status='completed' AND p.status='active'
      UNION ALL SELECT 'classes',count(*)::int FROM class_recording
      UNION ALL SELECT 'reportPublishedClasses',count(*)::int FROM lms_item WHERE published_at IS NOT NULL AND revoked_at IS NULL
      UNION ALL SELECT 'groupAlbum',count(*)::int FROM photo
      UNION ALL SELECT 'campAttendance',count(*)::int FROM camp
      UNION ALL SELECT 'reportFinanceDestinations',count(*)::int FROM program_event
      UNION ALL SELECT 'reportCosts',COALESCE(sum(total_amount),0)::bigint FROM program_event
    `,
    );
    return {
      generatedAt: new Date().toISOString(),
      metrics: metrics.map((metric) => ({
        ...metric,
        count: Number(metric.count),
      })),
    };
  }

  async people(
    actor: Actor,
    query: PaginationDto,
  ): Promise<DirectorPeoplePageDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'organization_report' },
      'detail',
    );
    const search = `%${normalizePersian(query.search ?? '').replace(/[\\%_]/g, '\\$&')}%`;
    const filter = `p.status='active' AND NOT p.external AND ($1='%%' OR p.search_name ILIKE $1)`;
    const total = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM person p WHERE ${filter}`,
      [search],
    );
    const items = await rows<DirectorPersonDto>(
      this.db,
      `SELECT p.id,p.first_name||' '||p.last_name AS name,p.org_level AS "orgLevel",
      COALESCE((SELECT g.name FROM membership m JOIN organization_group g ON g.id=m.group_id WHERE m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL LIMIT 1),'') AS "groupName"
      FROM person p WHERE ${filter} ORDER BY p.last_name,p.first_name,p.id LIMIT $2 OFFSET $3`,
      [search, query.limit, (query.page - 1) * query.limit],
    );
    return {
      items,
      total: Number(total?.count ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }
}
