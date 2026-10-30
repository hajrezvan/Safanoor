import { MigrationInterface, QueryRunner } from 'typeorm';

export class Lms1792195200019 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(200) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS class_recording (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        title varchar(200) NOT NULL,
        speaker varchar(200),
        summary text NOT NULL DEFAULT '',
        audio_file_id uuid REFERENCES file_record(id),
        cover_file_id uuid REFERENCES file_record(id),
        held_at timestamptz NOT NULL,
        created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS class_recording_group_held_idx
        ON class_recording(group_id, held_at DESC);

      CREATE TABLE IF NOT EXISTS lms_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recording_id uuid NOT NULL UNIQUE REFERENCES class_recording(id) ON DELETE CASCADE,
        course_id uuid REFERENCES course(id),
        sort_order int NOT NULL DEFAULT 0,
        published_at timestamptz,
        published_by uuid REFERENCES person(id),
        revoked_at timestamptz,
        revoked_by uuid REFERENCES person(id),
        revoke_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lms_item_published_idx
        ON lms_item(published_at DESC) WHERE published_at IS NOT NULL AND revoked_at IS NULL;
    `);
    for (const [action, relation] of [
      ['read', 'sameGroup'],
      ['read', 'groupMentor'],
      ['create', 'groupMentor'],
      ['update', 'groupMentor'],
      ['manage', 'groupMentor'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['lms_item', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='lms_item'",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS lms_item, class_recording, course',
    );
  }
}
