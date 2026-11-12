import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssistantWorkspace1792195200033 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE group_session (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES organization_group(id),
        title varchar(200) NOT NULL, starts_at timestamptz NOT NULL, created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX group_session_scope ON group_session(group_id,starts_at DESC);
      CREATE TABLE session_attendance (
        session_id uuid NOT NULL REFERENCES group_session(id), person_id uuid NOT NULL REFERENCES person(id),
        present boolean NOT NULL, marked_by uuid NOT NULL REFERENCES person(id), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(session_id,person_id)
      );
      CREATE TABLE follow_up_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES organization_group(id),
        member_id uuid NOT NULL REFERENCES person(id), created_by uuid NOT NULL REFERENCES person(id),
        kind varchar(20) NOT NULL CHECK(kind IN ('followup','task')), title varchar(200) NOT NULL,
        due_at timestamptz NOT NULL, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX follow_up_item_scope ON follow_up_item(group_id,member_id,due_at);
      CREATE TABLE person_emergency (
        person_id uuid PRIMARY KEY REFERENCES person(id), contact_enc text NOT NULL,
        address_enc text, medical_enc text, updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE camp_schedule_item ADD COLUMN responsible_person_id uuid REFERENCES person(id);
      INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level) VALUES
        ('assistant_workspace','read','*','assistantRole','detail'),
        ('follow_up_item','create','*','followingAssistant','detail'),
        ('follow_up_item','create','*','groupMentor','detail'),
        ('follow_up_item','update','*','followingAssistant','detail'),
        ('follow_up_item','update','*','groupMentor','detail'),
        ('session_attendance','update','*','followingAssistant','detail'),
        ('session_attendance','update','*','groupMentor','detail')
      ON CONFLICT DO NOTHING;
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM access_policy WHERE resource_type IN ('assistant_workspace','follow_up_item','session_attendance');
      ALTER TABLE camp_schedule_item DROP COLUMN responsible_person_id;
      DROP TABLE person_emergency,follow_up_item,session_attendance,group_session;`);
  }
}
