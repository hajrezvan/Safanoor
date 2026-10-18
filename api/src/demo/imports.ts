import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { gregorianToJalali } from '@safanoor/shared';
import { one, rows } from '../libs/database/database.types';
import { CryptoService } from '../libs/security/crypto.service';
import { demoGroupId, demoId, demoNationalId } from '../seed';
import { demoBirthDate, demoFixtureId, DemoPerson, hoursAgo } from './fixtures';

interface DemoImportRow {
  firstName: string;
  lastName: string;
  fatherName: string;
  birthDate: string;
  nationalId: string;
  phone: string;
  group: string;
  personId?: string;
  errors: string[];
}

export async function seedDemoImports(
  manager: EntityManager,
  people: DemoPerson[],
  crypto: CryptoService,
): Promise<void> {
  for (const owner of [3, 4, 40]) {
    const group = demoGroupId(owner === 4 ? 4 : 3);
    const permitted = await one(
      manager,
      `SELECT 1 FROM person p JOIN app_user u ON u.person_id=p.id
       WHERE p.id=$1 AND p.status='active' AND (u.is_admin OR EXISTS(
         SELECT 1 FROM organization_group g WHERE g.id=$2 AND g.owner_person_id=p.id))`,
      [demoId(owner), group],
    );
    if (!permitted) continue;
    for (const [stage, status] of ['completed', 'ready', 'invalid'].entries()) {
      const number = owner * 10 + stage;
      const id = demoFixtureId(4, number);
      if (await one(manager, 'SELECT 1 FROM import_job WHERE id=$1', [id]))
        continue;
      const records: DemoImportRow[] = [];
      if (status === 'completed') {
        const memberIds = await rows<{ id: string }>(
          manager,
          `SELECT person_id AS id FROM membership WHERE group_id=$1 AND role='member'
           AND valid_to IS NULL AND person_id=ANY($2::uuid[]) ORDER BY person_id LIMIT 2`,
          [
            group,
            people
              .filter((person) => person.level === 'member' && !person.external)
              .map((person) => person.id),
          ],
        );
        for (const { id: personId } of memberIds) {
          const person = people.find((item) => item.id === personId)!;
          records.push({
            firstName: person.firstName,
            lastName: person.lastName,
            fatherName: person.fatherName ?? 'رضا',
            birthDate: person.birthDate!,
            nationalId: demoNationalId(person.number),
            phone: person.phone,
            group,
            personId,
            errors: [],
          });
        }
      } else {
        for (let index = 0; index < (status === 'ready' ? 2 : 3); index++) {
          const candidate = 1000 + owner * 10 + stage * 3 + index;
          const nationalId = demoNationalId(candidate);
          const duplicate = await one(
            manager,
            'SELECT 1 FROM person WHERE national_id_hash=$1',
            [crypto.nationalIdHash(nationalId)],
          );
          const errors = duplicate ? ['این کد ملی قبلاً ثبت شده است.'] : [];
          if (status === 'invalid' && index === 0)
            errors.push('کد ملی معتبر نیست.');
          if (status === 'invalid' && index === 1)
            errors.push('تاریخ تولد جلالی معتبر نیست.');
          records.push({
            firstName: ['سامیار', 'علی‌اصغر', 'عرفان'][index],
            lastName: ['رستگار', 'شریفی', 'هاشمی'][index],
            fatherName: ['رضا', 'مجید', 'حسین'][index],
            birthDate: demoBirthDate(index === 0 ? 16 : 22, candidate),
            nationalId:
              status === 'invalid' && index === 0 ? '1234567890' : nationalId,
            phone: `+98910${String(candidate).padStart(7, '0')}`,
            group,
            errors,
          });
        }
      }
      const source = [
        'firstName,lastName,fatherName,birthDate,nationalId,phone,group',
        ...records.map((record, index) =>
          [
            record.firstName,
            record.lastName,
            record.fatherName,
            status === 'invalid' && index === 1
              ? '1405/13/40'
              : gregorianToJalali(record.birthDate),
            record.nationalId,
            record.phone,
            group,
          ].join(','),
        ),
      ].join('\n');
      const errorCount = records.filter(
        (record) => record.errors.length > 0,
      ).length;
      const inserted = await rows<{ id: string }>(
        manager,
        `INSERT INTO import_job(id,created_by,group_id,file_hash,source_enc,format,status,row_count,valid_count,
         error_count,created_at,updated_at,confirmed_at,completed_at)
         VALUES($1,$2,$3,$4,$5,'csv',$6,$7,$8,$9,$10,$10,$11,$11) ON CONFLICT DO NOTHING RETURNING id`,
        [
          id,
          demoId(owner),
          group,
          createHash('sha256').update(source).digest('hex'),
          status === 'completed'
            ? null
            : crypto.encrypt(
                Buffer.from(source).toString('base64'),
                'import-source',
              ),
          status === 'ready' && errorCount ? 'invalid' : status,
          records.length,
          records.length - errorCount,
          errorCount,
          hoursAgo(48 + stage * 24 + owner),
          status === 'completed' ? hoursAgo(47 + owner) : null,
        ],
      );
      if (!inserted.length) continue;
      for (const [index, record] of records.entries()) {
        const { errors, personId, ...data } = record;
        await rows(
          manager,
          `INSERT INTO import_row(job_id,row_number,data_enc,errors,person_id)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [
            id,
            index + 1,
            crypto.encrypt(JSON.stringify(data), 'import-row'),
            JSON.stringify(errors),
            personId ?? null,
          ],
        );
      }
      await rows(
        manager,
        `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
         VALUES($1,$2,$3,'import',$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
        [
          demoFixtureId(5, 1000 + number),
          demoId(owner),
          status === 'completed' ? 'import.completed' : 'import.validated',
          id,
          hoursAgo(47 + owner),
          JSON.stringify({ count: records.length, status: 'demo' }),
        ],
      );
    }
  }
}
