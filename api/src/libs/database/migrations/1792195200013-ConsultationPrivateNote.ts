import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsultationPrivateNote1792195200013 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consultation_private_note (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        consultation_id uuid NOT NULL UNIQUE REFERENCES consultation(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES person(id),
        body text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT consultation_private_note_body_len CHECK (char_length(body) <= 8000)
      );
      CREATE INDEX consultation_private_note_author_idx
        ON consultation_private_note(author_id);
    `);
    for (const [action, relation] of [
      ['create', 'self'],
      ['update', 'self'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['consultation_private_note', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM access_policy
       WHERE resource_type='consultation_private_note' AND action IN ('create','update')`,
    );
    await queryRunner.query('DROP TABLE IF EXISTS consultation_private_note');
  }
}
