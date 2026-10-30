import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudyPath1792195200008 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE study_path (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        title varchar(200) NOT NULL,
        description text,
        created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX study_path_group_idx ON study_path(group_id, created_at DESC);

      CREATE TABLE study_path_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        path_id uuid NOT NULL REFERENCES study_path(id) ON DELETE CASCADE,
        position int NOT NULL CHECK (position >= 0),
        book_title varchar(300) NOT NULL,
        book_author varchar(200),
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (path_id, position)
      );
      CREATE INDEX study_path_item_path_idx ON study_path_item(path_id, position);
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
        ['study_path', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='study_path'",
    );
    await queryRunner.query('DROP TABLE IF EXISTS study_path_item');
    await queryRunner.query('DROP TABLE IF EXISTS study_path');
  }
}
