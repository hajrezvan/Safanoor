import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import {
  jalaliToGregorian,
  latinDigits,
  normalizePersian,
  personSchema,
} from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { CryptoService } from '../../libs/security/crypto.service';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PeopleService } from '../people/people.service';
import { CreatePersonDto } from '../people/people.dto';
import { parseImport } from './import-parser';
import { ImportJobDto, ImportRowsPageDto, ImportsPageDto } from './imports.dto';

interface JobRow extends ImportJobDto {
  createdBy: string;
  sourceEnc: string | null;
  format: string;
}
interface StoredRow {
  rowNumber: number;
  dataEnc: string;
  errors: string[];
  personId: string | null;
}
const jobProjection =
  'id,group_id AS "groupId",created_by AS "createdBy",status,row_count AS "rowCount",valid_count AS "validCount",error_count AS "errorCount",created_at AS "createdAt",source_enc AS "sourceEnc",format';
@Injectable()
export class ImportsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
  ) {}
  private async job(actor: Actor, id: string): Promise<JobRow> {
    await this.access.require(
      actor,
      'read',
      await this.access.resolve('import', id, actor),
    );
    const job = await one<JobRow>(
      this.db,
      `SELECT ${jobProjection} FROM import_job WHERE id=$1 AND created_by=$2`,
      [id, actor.personId],
    );
    if (!job) throw new NotFoundException();
    return job;
  }
  private view(job: JobRow): ImportJobDto {
    return {
      id: job.id,
      groupId: job.groupId,
      status: job.status,
      rowCount: job.rowCount,
      validCount: job.validCount,
      errorCount: job.errorCount,
      createdAt: job.createdAt,
      canConfirm: job.status === 'ready' && job.errorCount === 0,
    };
  }
  async upload(
    actor: Actor,
    groupId: string,
    file: Express.Multer.File,
  ): Promise<ImportJobDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'import', groupIds: [groupId] },
      'detail',
    );
    if (
      !file ||
      file.size > 2 * 1024 * 1024 ||
      !/\.(csv|xlsx)$/i.test(file.originalname)
    )
      throw new BadRequestException(
        'فایل CSV یا XLSX تا ۲ مگابایت انتخاب کنید.',
      );
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const job = await this.db.transaction(async (manager) => {
      const item = await one<JobRow>(
        manager,
        `INSERT INTO import_job(created_by,group_id,file_hash,source_enc,format) VALUES($1,$2,$3,$4,$5) ON CONFLICT(created_by,group_id,file_hash) DO UPDATE SET updated_at=import_job.updated_at RETURNING ${jobProjection}`,
        [
          actor.personId,
          groupId,
          hash,
          this.crypto.encrypt(file.buffer.toString('base64'), 'import-source'),
          file.originalname.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
        ],
      );
      if (!item) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'import.uploaded',
        'import',
        item.id,
        {},
        manager,
      );
      return item;
    });
    if (job.status === 'queued')
      await this.jobs.send('import-validate', { id: job.id });
    return this.view(job);
  }
  async list(actor: Actor, query: PaginationDto): Promise<ImportsPageDto> {
    await this.access.require(actor, 'read', {
      type: 'import',
      ownerId: actor.personId,
    });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM import_job WHERE created_by=$1',
      [actor.personId],
    );
    const items = await rows<JobRow>(
      this.db,
      `SELECT ${jobProjection} FROM import_job WHERE created_by=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [actor.personId, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(
      items.map((item) => this.view(item)),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }
  async get(actor: Actor, id: string): Promise<ImportJobDto> {
    return this.view(await this.job(actor, id));
  }
  async preview(
    actor: Actor,
    id: string,
    query: PaginationDto,
  ): Promise<ImportRowsPageDto> {
    const job = await this.job(actor, id);
    const records = await this.db.transaction(async (manager) => {
      await rows(manager, "SELECT set_config('app.actor_id',$1,true)", [
        actor.personId,
      ]);
      return rows<StoredRow>(
        manager,
        'SELECT row_number AS "rowNumber",data_enc AS "dataEnc",errors,person_id AS "personId" FROM import_row WHERE job_id=$1 ORDER BY row_number LIMIT $2 OFFSET $3',
        [id, query.limit, (query.page - 1) * query.limit],
      );
    });
    const items = records.map((row) => {
      const data = JSON.parse(
        this.crypto.decrypt(row.dataEnc, 'import-row'),
      ) as Record<string, string>;
      return {
        rowNumber: row.rowNumber,
        name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        nationalIdMasked: `••••••${latinDigits(data.nationalId ?? '').slice(-4)}`,
        errors: row.errors,
      };
    });
    return pageOf(items, query.page, query.limit, job.rowCount);
  }
  async confirm(actor: Actor, id: string): Promise<ImportJobDto> {
    const job = await this.job(actor, id);
    await this.access.require(
      actor,
      'create',
      { type: 'import', groupIds: [job.groupId] },
      'detail',
    );
    if (job.status === 'completed') return this.view(job);
    if (!['ready', 'committing'].includes(job.status) || job.errorCount > 0)
      throw new ConflictException('ابتدا خطاهای فایل را برطرف کنید.');
    await rows(
      this.db,
      "UPDATE import_job SET status='committing',confirmed_at=COALESCE(confirmed_at,now()) WHERE id=$1 AND created_by=$2 AND status IN ('ready','committing')",
      [id, actor.personId],
    );
    await this.jobs.send('import-commit', { id });
    return this.get(actor, id);
  }
  private async workerJob(id: string): Promise<JobRow | undefined> {
    return one<JobRow>(
      this.db,
      `SELECT ${jobProjection} FROM import_job WHERE id=$1`,
      [id],
    );
  }
  async validate(id: string): Promise<void> {
    const job = await this.workerJob(id);
    if (
      !job ||
      !['queued', 'validating'].includes(job.status) ||
      !job.sourceEnc
    )
      return;
    try {
      const file = Buffer.from(
        this.crypto.decrypt(job.sourceEnc, 'import-source'),
        'base64',
      );
      const values = await parseImport(file, `import.${job.format}`);
      const group = await one<{ name: string }>(
        this.db,
        'SELECT name FROM organization_group WHERE id=$1',
        [job.groupId],
      );
      if (!group) throw new BadRequestException();
      const seen = new Set<string>();
      const prepared: { data: Record<string, string>; errors: string[] }[] = [];
      for (const value of values) {
        const errors: string[] = [];
        let birthDate = '';
        try {
          birthDate = jalaliToGregorian(value.birthDate);
        } catch {
          errors.push('تاریخ تولد جلالی معتبر نیست.');
        }
        const parsed = personSchema.safeParse({
          ...value,
          birthDate,
          nationalId: latinDigits(value.nationalId),
          orgLevel: 'member',
          groupId: job.groupId,
        });
        if (!parsed.success)
          errors.push(...parsed.error.issues.map((issue) => issue.message));
        if (
          normalizePersian(value.group) !== normalizePersian(group.name) &&
          value.group !== job.groupId
        )
          errors.push('گروه ردیف با گروه انتخاب‌شده برابر نیست.');
        const hash = this.crypto.nationalIdHash(latinDigits(value.nationalId));
        if (
          seen.has(hash) ||
          (await one(
            this.db,
            'SELECT 1 FROM person WHERE national_id_hash=$1',
            [hash],
          ))
        )
          errors.push('کد ملی تکراری است؛ رکورد قبلی باید بررسی شود.');
        seen.add(hash);
        prepared.push({
          data: parsed.success ? { ...value, ...parsed.data } : value,
          errors: [...new Set(errors)],
        });
      }
      await this.db.transaction(async (manager) => {
        await rows(manager, "SELECT set_config('app.worker','on',true)");
        const locked = await one<{ status: string }>(
          manager,
          'SELECT status FROM import_job WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (!locked || !['queued', 'validating'].includes(locked.status))
          return;
        await rows(manager, 'DELETE FROM import_row WHERE job_id=$1', [id]);
        for (const [index, row] of prepared.entries())
          await rows(
            manager,
            'INSERT INTO import_row(job_id,row_number,data_enc,errors) VALUES($1,$2,$3,$4)',
            [
              id,
              index + 2,
              this.crypto.encrypt(JSON.stringify(row.data), 'import-row'),
              JSON.stringify(row.errors),
            ],
          );
        const errors = prepared.filter((row) => row.errors.length > 0).length;
        await rows(
          manager,
          'UPDATE import_job SET status=$2,row_count=$3,valid_count=$4,error_count=$5,source_enc=NULL,updated_at=now() WHERE id=$1',
          [
            id,
            errors ? 'invalid' : 'ready',
            prepared.length,
            prepared.length - errors,
            errors,
          ],
        );
      });
    } catch {
      await rows(
        this.db,
        "UPDATE import_job SET status='failed',source_enc=NULL,updated_at=now() WHERE id=$1 AND status IN ('queued','validating')",
        [id],
      );
      await this.audit.record(
        job.createdBy,
        'import.validation_failed',
        'import',
        id,
      );
    }
  }
  async commit(id: string): Promise<void> {
    const job = await this.workerJob(id);
    if (!job || job.status !== 'committing') return;
    try {
      await this.db.transaction(async (manager) => {
        await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
        await rows(manager, "SELECT set_config('app.worker','on',true)");
        const current = await one<{ status: string }>(
          manager,
          'SELECT status FROM import_job WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (current?.status !== 'committing') return;
        const actor = await one<Actor>(
          manager,
          'SELECT u.id AS "userId",p.id AS "personId",u.is_admin AS "isAdmin",u.is_parent AS "isParent",p.org_level AS "orgLevel",p.status,p.external,p.consent_required AS "consentRequired" FROM app_user u JOIN person p ON p.id=u.person_id WHERE p.id=$1',
          [job.createdBy],
        );
        if (!actor || actor.status !== 'active')
          throw new BadRequestException();
        await this.access.require(
          actor,
          'create',
          { type: 'import', groupIds: [job.groupId] },
          'detail',
        );
        const records = await rows<StoredRow>(
          manager,
          'SELECT row_number AS "rowNumber",data_enc AS "dataEnc",errors,person_id AS "personId" FROM import_row WHERE job_id=$1 ORDER BY row_number',
          [id],
        );
        for (const row of records) {
          if (row.errors.length) throw new BadRequestException();
          if (row.personId) continue;
          const data = JSON.parse(
            this.crypto.decrypt(row.dataEnc, 'import-row'),
          ) as CreatePersonDto;
          const person = await this.people.create(
            actor,
            { ...data, groupId: job.groupId, orgLevel: 'member' },
            manager,
          );
          await rows(
            manager,
            'UPDATE import_row SET person_id=$3 WHERE job_id=$1 AND row_number=$2',
            [id, row.rowNumber, person.id],
          );
        }
        await rows(
          manager,
          "UPDATE import_job SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1",
          [id],
        );
        await this.audit.record(
          actor.personId,
          'import.committed',
          'import',
          id,
          { count: records.length },
          manager,
        );
        await this.notifications.create(
          actor.personId,
          'import.completed',
          `import:${id}`,
          manager,
        );
      });
    } catch {
      await rows(
        this.db,
        "UPDATE import_job SET status='failed',updated_at=now() WHERE id=$1 AND status='committing'",
        [id],
      );
      await this.audit.record(
        job.createdBy,
        'import.commit_failed',
        'import',
        id,
      );
    }
  }
}
