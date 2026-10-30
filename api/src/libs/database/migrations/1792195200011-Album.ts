import { MigrationInterface, QueryRunner } from 'typeorm';

export class Album1792195200011 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE photo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        host_group_id uuid NOT NULL REFERENCES organization_group(id),
        file_id uuid NOT NULL REFERENCES file_record(id),
        uploaded_by uuid NOT NULL REFERENCES person(id),
        title varchar(200),
        event_note varchar(500),
        taken_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX photo_host_group_idx ON photo(host_group_id, created_at DESC);

      CREATE TABLE photo_group (
        photo_id uuid NOT NULL REFERENCES photo(id) ON DELETE CASCADE,
        group_id uuid NOT NULL REFERENCES organization_group(id),
        hidden_by_group boolean NOT NULL DEFAULT false,
        PRIMARY KEY (photo_id, group_id)
      );
      CREATE INDEX photo_group_group_idx ON photo_group(group_id) WHERE hidden_by_group = false;

      CREATE TABLE photo_tag (
        photo_id uuid NOT NULL REFERENCES photo(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id),
        tagged_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (photo_id, person_id)
      );
      CREATE INDEX photo_tag_person_idx ON photo_tag(person_id);
    `);
    for (const [action, relation] of [
      ['create', 'hostMentor'],
      ['read', 'sameGroup'],
      ['read', 'groupMentor'],
      ['read', 'ancestor'],
      ['read', 'supervisor'],
      ['update', 'hostMentor'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['photo', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='photo' AND action='create'",
    );
    await queryRunner.query('DROP TABLE IF EXISTS photo_tag');
    await queryRunner.query('DROP TABLE IF EXISTS photo_group');
    await queryRunner.query('DROP TABLE IF EXISTS photo');
  }
}
