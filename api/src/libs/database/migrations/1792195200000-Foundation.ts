import { MigrationInterface, QueryRunner } from 'typeorm';

export class Foundation1792195200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE person (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), first_name varchar(80) NOT NULL,
        last_name varchar(100) NOT NULL, father_name varchar(80), birth_date date,
        national_id_enc text, national_id_hash char(64) UNIQUE,
        phone varchar(20) NOT NULL, search_name text NOT NULL,
        org_level varchar(20) NOT NULL CHECK (org_level IN ('supervisor','head_mentor','mentor','assistant','member')),
        availability varchar(20) NOT NULL DEFAULT 'available' CHECK (availability IN ('available','unavailable')),
        status varchar(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','purged')),
        external boolean NOT NULL DEFAULT false, verified_at timestamptz, verified_by uuid REFERENCES person(id),
        consent_required boolean NOT NULL DEFAULT true, left_at timestamptz, purge_after timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (birth_date <= CURRENT_DATE), CHECK(external OR (father_name IS NOT NULL AND birth_date IS NOT NULL AND national_id_enc IS NOT NULL AND national_id_hash IS NOT NULL))
      );
      CREATE INDEX person_search_idx ON person(search_name);
      CREATE INDEX person_status_idx ON person(status,org_level);
      CREATE TABLE app_user (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL UNIQUE REFERENCES person(id),
        login varchar(80) NOT NULL UNIQUE, password_hash text, is_admin boolean NOT NULL DEFAULT false,
        is_parent boolean NOT NULL DEFAULT false, failed_attempts integer NOT NULL DEFAULT 0,
        locked_until timestamptz, password_changed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE auth_session (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user(id),
        family_id uuid NOT NULL, refresh_hash char(64) NOT NULL UNIQUE, csrf_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL, revoked_at timestamptz, replaced_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX auth_session_user_idx ON auth_session(user_id,family_id);
      CREATE TABLE organization_group (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL,
        owner_person_id uuid NOT NULL REFERENCES person(id), created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE membership (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES person(id),
        group_id uuid NOT NULL REFERENCES organization_group(id), role varchar(15) NOT NULL CHECK(role IN ('member','assistant')),
        valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
        CHECK(valid_to IS NULL OR valid_to >= valid_from)
      );
      CREATE UNIQUE INDEX one_active_member ON membership(person_id) WHERE role='member' AND valid_to IS NULL;
      CREATE UNIQUE INDEX one_active_group_role ON membership(person_id,group_id,role) WHERE valid_to IS NULL;
      CREATE INDEX membership_group_idx ON membership(group_id,role) WHERE valid_to IS NULL;
      CREATE TABLE follow_up_assignment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_person_id uuid NOT NULL REFERENCES person(id),
        assistant_person_id uuid NOT NULL REFERENCES person(id), group_id uuid NOT NULL REFERENCES organization_group(id),
        from_date timestamptz NOT NULL DEFAULT now(), to_date timestamptz,
        CHECK(member_person_id<>assistant_person_id)
      );
      CREATE UNIQUE INDEX one_active_follow_up ON follow_up_assignment(member_person_id) WHERE to_date IS NULL;
      CREATE INDEX assistant_open_assignments ON follow_up_assignment(assistant_person_id) WHERE to_date IS NULL;
      CREATE TABLE group_role (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES organization_group(id),
        person_id uuid NOT NULL REFERENCES person(id), role varchar(30) NOT NULL,
        valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz
      );
      CREATE UNIQUE INDEX one_finance_officer ON group_role(group_id) WHERE role='finance_officer' AND valid_to IS NULL;
      CREATE TABLE person_ancestors (
        person_id uuid NOT NULL REFERENCES person(id), ancestor_id uuid NOT NULL REFERENCES person(id),
        depth integer NOT NULL CHECK(depth>0), PRIMARY KEY(person_id,ancestor_id), CHECK(person_id<>ancestor_id)
      );
      CREATE INDEX ancestors_ancestor_idx ON person_ancestors(ancestor_id,person_id);
      CREATE TABLE access_policy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_type varchar(50) NOT NULL,
        action varchar(20) NOT NULL, owner_role varchar(30) NOT NULL, viewer_relation varchar(40) NOT NULL,
        level varchar(10) NOT NULL CHECK(level IN ('none','summary','detail')),
        UNIQUE(resource_type,action,owner_role,viewer_relation)
      );
      CREATE TABLE resource_registry (
        resource_type varchar(50) NOT NULL, resource_id uuid NOT NULL,
        member_person_id uuid NOT NULL REFERENCES person(id), owner_person_id uuid NOT NULL REFERENCES person(id),
        owner_role varchar(30) NOT NULL, group_ids uuid[] NOT NULL DEFAULT '{}',
        PRIMARY KEY(resource_type,resource_id)
      );
      CREATE TABLE access_grant (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_type varchar(50) NOT NULL, resource_id uuid NOT NULL,
        member_person_id uuid NOT NULL REFERENCES person(id), grantee_person_id uuid NOT NULL REFERENCES person(id),
        granted_by uuid NOT NULL REFERENCES person(id), granted_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz, reason varchar(300) NOT NULL, parent_message_enc text,
        FOREIGN KEY(resource_type,resource_id) REFERENCES resource_registry(resource_type,resource_id)
      );
      CREATE INDEX active_grant_idx ON access_grant(grantee_person_id,resource_type,resource_id) WHERE revoked_at IS NULL;
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES person(id), action varchar(60) NOT NULL,
        resource_type varchar(50) NOT NULL, resource_id uuid, at timestamptz NOT NULL DEFAULT now(), meta jsonb NOT NULL DEFAULT '{}'
      );
      CREATE INDEX audit_at_idx ON audit_log(at DESC);
      CREATE FUNCTION deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_log_is_append_only'; END $$;
      CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
      CREATE TABLE emergency_access_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES person(id),
        accessed_by uuid NOT NULL REFERENCES person(id), reason_code varchar(30) NOT NULL, accessed_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE parent_link (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_user_id uuid NOT NULL REFERENCES app_user(id),
        child_person_id uuid NOT NULL REFERENCES person(id), confirmed_by uuid NOT NULL REFERENCES person(id),
        active boolean NOT NULL DEFAULT true, archived_at timestamptz, warned_at timestamptz,
        UNIQUE(parent_user_id,child_person_id)
      );
      CREATE TABLE consent_form_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version integer NOT NULL UNIQUE,
        title varchar(150) NOT NULL, items jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
        published_by uuid REFERENCES person(id)
      );
      CREATE TABLE consent_record (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES person(id),
        signer_id uuid NOT NULL REFERENCES app_user(id), version_id uuid NOT NULL REFERENCES consent_form_version(id),
        accepted_items text[] NOT NULL, at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX consent_person_idx ON consent_record(person_id,at DESC);
      CREATE TABLE notification (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES person(id),
        type varchar(60) NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
        dedupe_key varchar(160) UNIQUE
      );
      CREATE INDEX notifications_recipient_idx ON notification(recipient_id,created_at DESC);
      CREATE TABLE notification_delivery (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL REFERENCES notification(id),
        channel varchar(20) NOT NULL DEFAULT 'in_app', status varchar(20) NOT NULL DEFAULT 'pending', delivered_at timestamptz,
        UNIQUE(notification_id,channel)
      );
      CREATE TABLE import_job (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL REFERENCES person(id),
        group_id uuid NOT NULL REFERENCES organization_group(id), file_hash char(64) NOT NULL, source_enc text, format varchar(5) NOT NULL,
        status varchar(25) NOT NULL DEFAULT 'queued', row_count integer NOT NULL DEFAULT 0, valid_count integer NOT NULL DEFAULT 0,
        error_count integer NOT NULL DEFAULT 0, confirmed_at timestamptz, completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(created_by,group_id,file_hash), CHECK(status IN ('queued','validating','ready','invalid','committing','completed','failed'))
      );
      CREATE TABLE import_row (
        job_id uuid NOT NULL REFERENCES import_job(id) ON DELETE CASCADE, row_number integer NOT NULL,
        data_enc text NOT NULL, errors jsonb NOT NULL DEFAULT '[]', person_id uuid REFERENCES person(id),
        PRIMARY KEY(job_id,row_number)
      );
      CREATE TABLE retention_policy (
        data_type varchar(50) PRIMARY KEY, keep_days integer NOT NULL CHECK(keep_days BETWEEN 1 AND 3650),
        action varchar(15) NOT NULL CHECK(action IN ('delete','anonymize','archive')), proposed boolean NOT NULL DEFAULT true
      );
      CREATE TABLE file_record (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind varchar(30) NOT NULL, storage_key text NOT NULL UNIQUE,
        size integer NOT NULL CHECK(size>0), mime_type varchar(100) NOT NULL, created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(), purge_after timestamptz
      );
      CREATE TABLE seed_scenario (
        name varchar(50) PRIMARY KEY, metadata jsonb NOT NULL, confidential_enc text NOT NULL
      );
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS seed_scenario,file_record,retention_policy,import_row,import_job,notification_delivery,notification,consent_record,consent_form_version,parent_link,emergency_access_log,audit_log,access_grant,resource_registry,access_policy,person_ancestors,group_role,follow_up_assignment,membership,organization_group,auth_session,app_user,person CASCADE; DROP FUNCTION IF EXISTS deny_audit_mutation();`,
    );
  }
}
