import { MigrationInterface, QueryRunner } from 'typeorm';
import { initialConsentItems } from '../../config/defaults';
export class Defaults1792195200003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO consent_form_version(version,title,items) VALUES(1,'با آگاهی، کنار هم',$1) ON CONFLICT DO NOTHING",
      [JSON.stringify(initialConsentItems)],
    );
    for (const [type, days, action] of [
      ['meeting_audio', 30, 'delete'],
      ['temporary_upload', 3, 'delete'],
      ['permit_photo', 365, 'delete'],
      ['audit_log', 730, 'delete'],
      ['notification', 90, 'delete'],
      ['left_person', 395, 'anonymize'],
    ])
      await queryRunner.query(
        'INSERT INTO retention_policy(data_type,keep_days,action) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [type, days, action],
      );
    await queryRunner.query(`CREATE FUNCTION deny_consent_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'consent_is_versioned' USING ERRCODE='23514'; END $$;
 CREATE TRIGGER immutable_consent_version BEFORE UPDATE ON consent_form_version FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION deny_consent_update();
 CREATE TRIGGER immutable_consent_record BEFORE UPDATE ON consent_record FOR EACH ROW EXECUTE FUNCTION deny_consent_update();`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER immutable_consent_version ON consent_form_version; DROP TRIGGER immutable_consent_record ON consent_record; DROP FUNCTION deny_consent_update();',
    );
  }
}
