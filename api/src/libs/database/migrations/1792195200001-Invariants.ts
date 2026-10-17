import { MigrationInterface, QueryRunner } from 'typeorm';

export class Invariants1792195200001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION validate_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_id uuid; member_count integer; person_row person%ROWTYPE;
      BEGIN
        IF TG_TABLE_NAME='person' THEN target_id:=NEW.id; ELSE target_id:=COALESCE(NEW.person_id,OLD.person_id); END IF;
        SELECT * INTO person_row FROM person WHERE id=target_id;
        SELECT count(*) INTO member_count FROM membership WHERE person_id=target_id AND role='member' AND valid_to IS NULL;
        IF person_row.status='active' AND NOT person_row.external AND person_row.org_level<>'supervisor' AND member_count<>1 THEN RAISE EXCEPTION 'exactly_one_active_member_required' USING ERRCODE='23514'; END IF;
        IF person_row.org_level='supervisor' AND member_count<>0 THEN RAISE EXCEPTION 'supervisor_cannot_have_mentor' USING ERRCODE='23514'; END IF;
        IF EXISTS(SELECT 1 FROM membership a WHERE a.person_id=target_id AND a.role='assistant' AND a.valid_to IS NULL AND NOT EXISTS(SELECT 1 FROM membership m WHERE m.person_id=a.person_id AND m.group_id=a.group_id AND m.role='member' AND m.valid_to IS NULL)) THEN RAISE EXCEPTION 'assistant_requires_same_group_membership' USING ERRCODE='23514'; END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER valid_person_membership AFTER INSERT OR UPDATE ON person DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_membership();
      CREATE CONSTRAINT TRIGGER valid_membership AFTER INSERT OR UPDATE OR DELETE ON membership DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_membership();
      CREATE FUNCTION prevent_hierarchy_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE owner_id uuid;
      BEGIN
        IF NEW.role<>'member' OR NEW.valid_to IS NOT NULL THEN RETURN NEW; END IF;
        PERFORM pg_advisory_xact_lock(739201);
        SELECT owner_person_id INTO owner_id FROM organization_group WHERE id=NEW.group_id;
        IF NEW.person_id=owner_id OR EXISTS(
          WITH RECURSIVE ancestors(id,path) AS (
            SELECT owner_id,ARRAY[owner_id] UNION ALL
            SELECT g.owner_person_id,a.path||g.owner_person_id FROM ancestors a JOIN membership m ON m.person_id=a.id AND m.role='member' AND m.valid_to IS NULL JOIN organization_group g ON g.id=m.group_id WHERE NOT g.owner_person_id=ANY(a.path)
          ) SELECT 1 FROM ancestors WHERE id=NEW.person_id
        ) THEN RAISE EXCEPTION 'hierarchy_cycle' USING ERRCODE='23514'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER no_hierarchy_cycle BEFORE INSERT OR UPDATE ON membership FOR EACH ROW EXECUTE FUNCTION prevent_hierarchy_cycle();
      CREATE FUNCTION limit_supervisors() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.org_level='supervisor' AND NEW.status='active' THEN
          PERFORM pg_advisory_xact_lock(739202);
          IF (SELECT count(*) FROM person WHERE org_level='supervisor' AND status='active' AND id<>NEW.id)>=5 THEN RAISE EXCEPTION 'supervisor_roster_full' USING ERRCODE='23514'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER supervisor_limit BEFORE INSERT OR UPDATE ON person FOR EACH ROW EXECUTE FUNCTION limit_supervisors();
      ALTER TABLE import_row ENABLE ROW LEVEL SECURITY;
      ALTER TABLE import_row FORCE ROW LEVEL SECURITY;
      CREATE POLICY import_row_owner ON import_row USING (
        current_setting('app.worker',true)='on' OR EXISTS(SELECT 1 FROM import_job j WHERE j.id=job_id AND j.created_by::text=current_setting('app.actor_id',true))
      ) WITH CHECK (
        current_setting('app.worker',true)='on' OR EXISTS(SELECT 1 FROM import_job j WHERE j.id=job_id AND j.created_by::text=current_setting('app.actor_id',true))
      );
      ALTER TABLE seed_scenario ENABLE ROW LEVEL SECURITY;
      ALTER TABLE seed_scenario FORCE ROW LEVEL SECURITY;
      CREATE POLICY seed_scenario_worker ON seed_scenario USING(current_setting('app.worker',true)='on') WITH CHECK(current_setting('app.worker',true)='on');
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS valid_person_membership ON person; DROP TRIGGER IF EXISTS valid_membership ON membership; DROP TRIGGER IF EXISTS no_hierarchy_cycle ON membership; DROP TRIGGER IF EXISTS supervisor_limit ON person; DROP FUNCTION IF EXISTS validate_membership(),prevent_hierarchy_cycle(),limit_supervisors(); DROP POLICY IF EXISTS import_row_owner ON import_row; DROP POLICY IF EXISTS seed_scenario_worker ON seed_scenario; ALTER TABLE import_row DISABLE ROW LEVEL SECURITY; ALTER TABLE seed_scenario DISABLE ROW LEVEL SECURITY;`,
    );
  }
}
