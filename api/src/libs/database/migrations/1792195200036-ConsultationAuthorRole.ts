import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve note privacy when a mentor/assistant later changes organizational roles. */
export class ConsultationAuthorRole1792195200036 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE consultation ADD COLUMN author_role varchar(20);
      -- Old rows have no historical role evidence: preserve the stricter author-only privacy.
      UPDATE consultation SET author_role='mentor';
      ALTER TABLE consultation ALTER COLUMN author_role SET NOT NULL;
      ALTER TABLE consultation ADD CONSTRAINT consultation_author_role_check CHECK(author_role IN ('mentor','assistant'));
      CREATE FUNCTION consultation_author_role_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='INSERT' THEN
          NEW.author_role=CASE WHEN EXISTS(SELECT 1 FROM organization_group g WHERE g.id=NEW.group_id AND g.owner_person_id=NEW.author_id) THEN 'mentor' ELSE 'assistant' END;
        ELSIF NEW.author_role IS DISTINCT FROM OLD.author_role OR NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
          RAISE EXCEPTION 'consultation_author_role_is_immutable';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER consultation_author_role_snapshot BEFORE INSERT OR UPDATE ON consultation FOR EACH ROW EXECUTE FUNCTION consultation_author_role_snapshot();`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP TRIGGER consultation_author_role_snapshot ON consultation; DROP FUNCTION consultation_author_role_snapshot(); ALTER TABLE consultation DROP COLUMN author_role;`,
    );
  }
}
