import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { STORAGE, StorageAdapter } from '../files/storage';
import {
  CampDetailDto,
  CampParticipantDto,
  CampPermitDto,
  CampStatus,
  CampSummaryDto,
  CampsPageDto,
  CampsQueryDto,
  CreateCampDto,
  UpdateCampDto,
} from './camps.dto';

@Injectable()
export class CampsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async list(actor: Actor, query: CampsQueryDto): Promise<CampsPageDto> {
    if (actor.isParent || actor.external)
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    const groupId = query.groupId;
    if (groupId) {
      await this.access.require(
        actor,
        'read',
        { type: 'camp', groupIds: [groupId] },
        'detail',
      );
      await this.requireVisibleGroup(groupId);
    }
    const visible = this.visibleSql(1);
    const search = normalizePersian(query.search ?? '');
    const scope = groupId
      ? `${visible} AND c.group_id=$2 AND ($3='' OR c.title LIKE '%'||$3||'%' OR COALESCE(c.place,'') LIKE '%'||$3||'%')`
      : `${visible} AND ($2='' OR c.title LIKE '%'||$2||'%' OR COALESCE(c.place,'') LIKE '%'||$2||'%')`;
    const countParams = groupId
      ? [actor.personId, groupId, search]
      : [actor.personId, search];
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM camp c WHERE ${scope}`,
      countParams,
    );
    const limit = query.limit;
    const offset = (query.page - 1) * query.limit;
    const listParams = groupId
      ? [actor.personId, groupId, search, actor.personId, limit, offset]
      : [actor.personId, search, actor.personId, limit, offset];
    const mentorParam = groupId ? 4 : 3;
    const limitParam = groupId ? 5 : 4;
    const offsetParam = groupId ? 6 : 5;
    const items = await rows<CampSummaryDto>(
      this.db,
      `SELECT ${this.summarySelect(mentorParam)}
       FROM camp c
       WHERE ${scope}
       ORDER BY c.starts_on DESC, c.id
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listParams,
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async get(actor: Actor, id: string): Promise<CampDetailDto> {
    const camp = await this.loadRow(id);
    await this.access.require(
      actor,
      'read',
      { type: 'camp', id, groupIds: [camp.groupId] },
      'detail',
    );
    return this.loadDetail(actor, id);
  }

  async create(actor: Actor, input: CreateCampDto): Promise<CampDetailDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'camp', groupIds: [input.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, input.groupId);
    const title = normalizePersian(input.title.trim());
    if (title.length < 2) throw new BadRequestException('عنوان اردو را وارد کن.');
    const startsOn = this.parseDate(input.startsOn, 'تاریخ شروع');
    const endsOn = this.parseDate(input.endsOn, 'تاریخ پایان');
    if (endsOn < startsOn)
      throw new BadRequestException('تاریخ پایان نمی‌تواند قبل از شروع باشد.');
    const place = this.normalizeOptional(input.place, 200);
    const purpose = this.normalizeOptional(input.purpose, 4000);
    const durationText = this.normalizeOptional(input.durationText, 100);
    const scheduleText = this.normalizeOptional(input.scheduleText, 8000);
    const costAmount = this.normalizeAmount(input.costAmount);
    const participantIds = await this.validateParticipants(
      input.groupId,
      input.participantIds ?? [],
    );
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO camp(
           group_id,organizer_person_id,title,place,purpose,cost_amount,
           duration_text,starts_on,ends_on,schedule_text,status,created_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10,'draft',$2)
         RETURNING id`,
        [
          input.groupId,
          actor.personId,
          title,
          place,
          purpose,
          costAmount,
          durationText,
          startsOn,
          endsOn,
          scheduleText,
        ],
      );
      if (!row) throw new BadRequestException();
      await this.replaceParticipants(
        manager,
        row.id,
        input.groupId,
        participantIds,
      );
      await this.audit.record(
        actor.personId,
        'camp.created',
        'camp',
        row.id,
        {},
        manager,
      );
      return row.id;
    });
    return this.loadDetail(actor, created);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateCampDto,
  ): Promise<CampDetailDto> {
    const current = await this.loadRow(id);
    await this.access.require(
      actor,
      'update',
      { type: 'camp', id, groupIds: [current.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, current.groupId);
    const title =
      input.title !== undefined
        ? normalizePersian(input.title.trim())
        : current.title;
    if (title.length < 2) throw new BadRequestException('عنوان اردو را وارد کن.');
    const startsOn =
      input.startsOn !== undefined
        ? this.parseDate(input.startsOn, 'تاریخ شروع')
        : current.startsOn;
    const endsOn =
      input.endsOn !== undefined
        ? this.parseDate(input.endsOn, 'تاریخ پایان')
        : current.endsOn;
    if (endsOn < startsOn)
      throw new BadRequestException('تاریخ پایان نمی‌تواند قبل از شروع باشد.');
    const place =
      input.place !== undefined
        ? this.normalizeOptional(input.place, 200)
        : current.place;
    const purpose =
      input.purpose !== undefined
        ? this.normalizeOptional(input.purpose, 4000)
        : current.purpose;
    const durationText =
      input.durationText !== undefined
        ? this.normalizeOptional(input.durationText, 100)
        : current.durationText;
    const scheduleText =
      input.scheduleText !== undefined
        ? this.normalizeOptional(input.scheduleText, 8000)
        : current.scheduleText;
    const costAmount =
      input.costAmount !== undefined
        ? this.normalizeAmount(input.costAmount)
        : current.costAmount;
    const participantIds =
      input.participantIds !== undefined
        ? await this.validateParticipants(current.groupId, input.participantIds)
        : null;
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `UPDATE camp SET
           title=$2,place=$3,purpose=$4,cost_amount=$5,duration_text=$6,
           starts_on=$7::date,ends_on=$8::date,schedule_text=$9,updated_at=now()
         WHERE id=$1`,
        [
          id,
          title,
          place,
          purpose,
          costAmount,
          durationText,
          startsOn,
          endsOn,
          scheduleText,
        ],
      );
      if (participantIds)
        await this.replaceParticipants(
          manager,
          id,
          current.groupId,
          participantIds,
        );
      await this.audit.record(
        actor.personId,
        'camp.updated',
        'camp',
        id,
        {},
        manager,
      );
    });
    return this.loadDetail(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const current = await this.loadRow(id);
    await this.access.require(
      actor,
      'manage',
      { type: 'camp', id, groupIds: [current.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, current.groupId);
    await this.db.transaction(async (manager) => {
      await rows(manager, 'DELETE FROM camp WHERE id=$1', [id]);
      await this.audit.record(
        actor.personId,
        'camp.deleted',
        'camp',
        id,
        {},
        manager,
      );
    });
  }

  async uploadPermit(
    actor: Actor,
    id: string,
    file: Express.Multer.File | undefined,
  ): Promise<CampDetailDto> {
    const current = await this.loadRow(id);
    await this.access.require(
      actor,
      'update',
      { type: 'camp', id, groupIds: [current.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, current.groupId);
    if (!file || !file.buffer?.length)
      throw new BadRequestException('تصویر حکم اردویی را انتخاب کن.');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('حجم تصویر باید حداکثر ۵ مگابایت باشد.');
    const mime = file.mimetype || '';
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(mime))
      throw new BadRequestException(
        'فقط تصویر JPEG، PNG، WebP یا GIF پذیرفته می‌شود.',
      );
    const storageKey = randomUUID();
    await this.storage.put(storageKey, file.buffer, mime);
    await this.db.transaction(async (manager) => {
      const fileRow = await one<{ id: string }>(
        manager,
        `INSERT INTO file_record(kind,storage_key,size,mime_type,created_by)
         VALUES('camp_permit',$1,$2,$3,$4) RETURNING id`,
        [storageKey, file.size, mime, actor.personId],
      );
      if (!fileRow) throw new BadRequestException();
      await rows(
        manager,
        `INSERT INTO camp_permit(camp_id,image_file_id,uploaded_by,status)
         VALUES($1,$2,$3,'obtained')
         ON CONFLICT (camp_id) DO UPDATE SET
           image_file_id=EXCLUDED.image_file_id,
           uploaded_by=EXCLUDED.uploaded_by,
           status='obtained',
           created_at=now()`,
        [id, fileRow.id, actor.personId],
      );
      await rows(
        manager,
        `UPDATE camp SET
           status=CASE
             WHEN status IN ('draft','permit_pending') THEN 'permit_ok'
             ELSE status
           END,
           updated_at=now()
         WHERE id=$1`,
        [id],
      );
      await this.audit.record(
        actor.personId,
        'camp.permit_uploaded',
        'camp',
        id,
        {},
        manager,
      );
    });
    return this.loadDetail(actor, id);
  }

  private summarySelect(mentorParam: number): string {
    return `c.id,c.group_id AS "groupId",c.title,c.place,c.purpose,
      c.cost_amount AS "costAmount",c.duration_text AS "durationText",
      c.starts_on::text AS "startsOn",c.ends_on::text AS "endsOn",c.status,
      (SELECT count(*)::int FROM camp_participant p WHERE p.camp_id=c.id) AS "participantCount",
      EXISTS(SELECT 1 FROM camp_permit pe WHERE pe.camp_id=c.id) AS "hasPermit",
      c.created_by AS "createdBy",c.created_at AS "createdAt",c.updated_at AS "updatedAt",
      EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=c.group_id AND g.owner_person_id=$${mentorParam}
      ) AS "canManage"`;
  }

  private visibleSql(actorParam: number): string {
    return `(
      EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=c.group_id AND g.owner_person_id=$${actorParam}
      )
      OR EXISTS(
        SELECT 1 FROM membership m
        WHERE m.group_id=c.group_id AND m.person_id=$${actorParam} AND m.valid_to IS NULL
      )
    )`;
  }

  private async loadDetail(
    actor: Actor,
    id: string,
  ): Promise<CampDetailDto> {
    const summary = await one<CampSummaryDto & { scheduleText: string | null; organizerPersonId: string }>(
      this.db,
      `SELECT ${this.summarySelect(2)},
        c.schedule_text AS "scheduleText",
        c.organizer_person_id AS "organizerPersonId"
       FROM camp c WHERE c.id=$1`,
      [id, actor.personId],
    );
    if (!summary) throw new NotFoundException();
    const participants = await rows<CampParticipantDto>(
      this.db,
      `SELECT p.person_id AS "personId",
        pe.first_name||' '||pe.last_name AS name,
        p.status
       FROM camp_participant p
       JOIN person pe ON pe.id=p.person_id
       WHERE p.camp_id=$1
       ORDER BY pe.first_name,pe.last_name,p.person_id`,
      [id],
    );
    const permit = await one<CampPermitDto>(
      this.db,
      `SELECT id,image_file_id AS "imageFileId",status,
        uploaded_by AS "uploadedBy",created_at AS "createdAt"
       FROM camp_permit WHERE camp_id=$1`,
      [id],
    );
    return {
      ...summary,
      participants,
      permit: permit ?? null,
    };
  }

  private async loadRow(id: string): Promise<{
    id: string;
    groupId: string;
    title: string;
    place: string | null;
    purpose: string | null;
    costAmount: number | null;
    durationText: string | null;
    startsOn: string;
    endsOn: string;
    scheduleText: string | null;
    status: CampStatus;
  }> {
    const row = await one<{
      id: string;
      groupId: string;
      title: string;
      place: string | null;
      purpose: string | null;
      costAmount: number | null;
      durationText: string | null;
      startsOn: string;
      endsOn: string;
      scheduleText: string | null;
      status: CampStatus;
    }>(
      this.db,
      `SELECT id,group_id AS "groupId",title,place,purpose,
        cost_amount AS "costAmount",duration_text AS "durationText",
        starts_on::text AS "startsOn",ends_on::text AS "endsOn",
        schedule_text AS "scheduleText",status
       FROM camp WHERE id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }

  private parseDate(value: string, label: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException(`${label} معتبر نیست.`);
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (Number.isNaN(time))
      throw new BadRequestException(`${label} معتبر نیست.`);
    return value;
  }

  private normalizeOptional(
    value: string | null | undefined,
    max: number,
  ): string | null {
    if (value === undefined || value === null) return null;
    const text = normalizePersian(value.trim());
    if (!text) return null;
    if (text.length > max)
      throw new BadRequestException('متن واردشده بیش از حد طولانی است.');
    return text;
  }

  private normalizeAmount(value: number | null | undefined): number | null {
    if (value === undefined || value === null) return null;
    if (!Number.isInteger(value) || value < 0)
      throw new BadRequestException('هزینه باید عدد صحیح غیرمنفی (تومان) باشد.');
    return value;
  }

  private async validateParticipants(
    groupId: string,
    participantIds: string[],
  ): Promise<string[]> {
    const unique = [...new Set(participantIds)];
    if (unique.length === 0) return [];
    const allowed = await rows<{ id: string }>(
      this.db,
      `SELECT p.id FROM person p
       WHERE p.id=ANY($1::uuid[]) AND p.status='active'
         AND (
           EXISTS(
             SELECT 1 FROM membership m
             WHERE m.person_id=p.id AND m.group_id=$2 AND m.valid_to IS NULL
           )
           OR EXISTS(
             SELECT 1 FROM organization_group g
             WHERE g.id=$2 AND g.owner_person_id=p.id
           )
         )`,
      [unique, groupId],
    );
    if (allowed.length !== unique.length)
      throw new BadRequestException(
        'لیست اسمی باید از افراد فعال همین گروه باشد.',
      );
    return unique;
  }

  private async replaceParticipants(
    manager: EntityManager,
    campId: string,
    groupId: string,
    participantIds: string[],
  ): Promise<void> {
    await rows(manager, 'DELETE FROM camp_participant WHERE camp_id=$1', [
      campId,
    ]);
    for (const personId of participantIds)
      await rows(
        manager,
        `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
         VALUES($1,$2,$3,'confirmed')`,
        [campId, personId, groupId],
      );
  }

  private async requireVisibleGroup(groupId: string): Promise<void> {
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1',
        [groupId],
      ))
    )
      throw new NotFoundException();
  }

  private async requireOwnedGroup(
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    await this.requireVisibleGroup(groupId);
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
        [groupId, actor.personId],
      ))
    )
      throw new BadRequestException(
        'فقط مربی صاحب گروه می‌تواند اردو را مدیریت کند.',
      );
  }
}
