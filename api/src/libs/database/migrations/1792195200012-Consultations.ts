import { MigrationInterface, QueryRunner } from 'typeorm';

export class Consultations1792195200012 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consultation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        author_id uuid NOT NULL REFERENCES person(id),
        held_at timestamptz NOT NULL,
        kind varchar(20) NOT NULL CHECK (kind IN ('in_person', 'phone')),
        duration_minutes int NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480),
        place varchar(200),
        shared_summary text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT consultation_place_for_in_person CHECK (
          kind = 'phone' OR (place IS NOT NULL AND char_length(btrim(place)) > 0)
        )
      );
      CREATE INDEX consultation_group_held_idx ON consultation(group_id, held_at DESC);
      CREATE INDEX consultation_author_held_idx ON consultation(author_id, held_at DESC);
      CREATE INDEX consultation_held_idx ON consultation(held_at DESC);

      CREATE TABLE consultation_member (
        consultation_id uuid NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id),
        PRIMARY KEY (consultation_id, person_id)
      );
      CREATE INDEX consultation_member_person_idx ON consultation_member(person_id);
    `);
    for (const [action, relation] of [
      ['read', 'attendee'],
      ['read', 'self'],
      ['read', 'groupMentor'],
      ['read', 'followingAssistant'],
      ['create', 'groupMentor'],
      ['create', 'otherAssistant'],
      ['update', 'self'],
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
        ['consultation', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='consultation'",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS consultation_member, consultation',
    );
  }
}
