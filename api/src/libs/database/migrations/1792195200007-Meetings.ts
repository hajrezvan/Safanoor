import { MigrationInterface, QueryRunner } from 'typeorm';

export class Meetings1792195200007 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE meeting (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        held_at timestamptz NOT NULL,
        kind varchar(20) NOT NULL CHECK (kind IN ('public', 'workgroup')),
        title varchar(200) NOT NULL,
        place varchar(200),
        status varchar(20) NOT NULL DEFAULT 'recorded'
          CHECK (status IN ('draft', 'recorded', 'approved')),
        created_by uuid NOT NULL REFERENCES person(id),
        agenda text NOT NULL DEFAULT '',
        summary text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX meeting_group_held_idx ON meeting(group_id, held_at DESC);
      CREATE INDEX meeting_held_idx ON meeting(held_at DESC);

      CREATE TABLE meeting_attendee (
        meeting_id uuid NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id),
        PRIMARY KEY (meeting_id, person_id)
      );
      CREATE INDEX meeting_attendee_person_idx ON meeting_attendee(person_id);

      CREATE TABLE resolution (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
        assignee_id uuid REFERENCES person(id),
        due_date date,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX resolution_meeting_idx ON resolution(meeting_id, sort_order, id);
    `);
    for (const [action, relation] of [
      ['read', 'attendee'],
      ['read', 'attendeeAncestor'],
      ['create', 'groupMentor'],
      ['update', 'groupMentor'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['meeting', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='meeting' AND action IN ('create','update')",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS resolution, meeting_attendee, meeting',
    );
  }
}
