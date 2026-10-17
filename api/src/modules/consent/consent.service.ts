import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ageOn, consentItems, requiredConsentItems } from '@safanoor/shared';
import { one, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConsentRecordDto,
  ConsentStatusDto,
  ConsentVersionDto,
  PublishConsentDto,
  RecordConsentDto,
} from './consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}
  async status(
    actor: Actor,
    personId = actor.personId,
  ): Promise<ConsentStatusDto> {
    const resource = await this.access.personResource(personId);
    await this.access.require(actor, 'read', { ...resource, type: 'consent' });
    const version = await one<ConsentVersionDto>(
      this.db,
      'SELECT id,version,title,items,published_at AS "publishedAt" FROM consent_form_version ORDER BY version DESC LIMIT 1',
    );
    if (!version)
      throw new NotFoundException('نسخهٔ رضایت‌نامه هنوز منتشر نشده است.');
    const person = await one<{ birthDate: string }>(
      this.db,
      'SELECT to_char(birth_date,\'YYYY-MM-DD\') AS "birthDate" FROM person WHERE id=$1',
      [personId],
    );
    if (!person) throw new NotFoundException();
    const minor = person.birthDate ? ageOn(person.birthDate) < 18 : false;
    const relations = await this.access.relations(actor, resource);
    const records = await rows<ConsentRecordDto>(
      this.db,
      'SELECT id,person_id AS "personId",version_id AS "versionId",accepted_items AS "acceptedItems",at FROM consent_record WHERE person_id=$1 ORDER BY at DESC LIMIT 50',
      [personId],
    );
    return {
      version,
      records,
      canSign: minor ? relations.parent : relations.self,
      signerIsParent: minor,
    };
  }
  async record(
    actor: Actor,
    input: RecordConsentDto,
  ): Promise<ConsentRecordDto> {
    const resource = await this.access.personResource(input.personId);
    await this.access.require(
      actor,
      'create',
      { ...resource, type: 'consent' },
      'detail',
    );
    const status = await this.status(actor, input.personId);
    if (!status.canSign)
      throw new BadRequestException(
        'رضایت فرد زیر ۱۸ سال باید توسط والد تأییدشده ثبت شود.',
      );
    if (input.versionId !== status.version.id)
      throw new BadRequestException(
        'نسخهٔ رضایت‌نامه تغییر کرده است. صفحه را تازه کنید.',
      );
    if (!requiredConsentItems.every((key) => input.acceptedItems.includes(key)))
      throw new BadRequestException(
        'پذیرش موارد ضروری برای استفاده از سامانه لازم است.',
      );
    return this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739203)');
      const current = await one<{ id: string }>(
        manager,
        'SELECT id FROM consent_form_version ORDER BY version DESC LIMIT 1',
      );
      if (current?.id !== input.versionId)
        throw new BadRequestException('نسخهٔ رضایت‌نامه تغییر کرده است.');
      const result = await one<ConsentRecordDto>(
        manager,
        'INSERT INTO consent_record(person_id,signer_id,version_id,accepted_items) VALUES($1,$2,$3,$4) RETURNING id,person_id AS "personId",version_id AS "versionId",accepted_items AS "acceptedItems",at',
        [input.personId, actor.userId, input.versionId, input.acceptedItems],
      );
      if (!result) throw new BadRequestException();
      await rows(
        manager,
        'UPDATE person SET consent_required=false WHERE id=$1',
        [input.personId],
      );
      await this.audit.record(
        actor.personId,
        'consent.recorded',
        'consent',
        input.personId,
        { version: status.version.version },
        manager,
      );
      return result;
    });
  }
  async publish(
    actor: Actor,
    input: PublishConsentDto,
  ): Promise<ConsentVersionDto> {
    await this.access.require(actor, 'manage', { type: 'consent' }, 'detail');
    if (
      input.items.length !== consentItems.length ||
      new Set(input.items.map((item) => item.key)).size !==
        consentItems.length ||
      input.items.some(
        (item) => item.required !== requiredConsentItems.includes(item.key),
      )
    )
      throw new BadRequestException(
        'همهٔ موارد رضایت باید با وضعیت ضروری صحیح درج شوند.',
      );
    return this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739203)');
      const result = await one<ConsentVersionDto>(
        manager,
        'INSERT INTO consent_form_version(version,title,items,published_by) SELECT COALESCE(max(version),0)+1,$1,$2,$3 FROM consent_form_version RETURNING id,version,title,items,published_at AS "publishedAt"',
        [input.title, JSON.stringify(input.items), actor.personId],
      );
      if (!result) throw new BadRequestException();
      await rows(
        manager,
        "UPDATE person SET consent_required=true WHERE status='active'",
      );
      const recipients = await rows<{ id: string }>(
        manager,
        "SELECT id FROM person WHERE status='active'",
      );
      for (const recipient of recipients)
        await this.notifications.create(
          recipient.id,
          'consent.updated',
          `consent:${result.id}:${recipient.id}`,
          manager,
        );
      await this.audit.record(
        actor.personId,
        'consent.published',
        'consent',
        result.id,
        { version: result.version },
        manager,
      );
      return result;
    });
  }
}
