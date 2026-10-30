import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationOption1792195200014 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE location_option (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        label varchar(200) NOT NULL,
        label_normalized varchar(200) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX location_option_label_uidx
        ON location_option(label_normalized);
      CREATE INDEX location_option_active_idx
        ON location_option(active, label);

      ALTER TABLE photo
        ADD COLUMN location_option_id uuid REFERENCES location_option(id);
      CREATE INDEX photo_location_idx ON photo(location_option_id)
        WHERE location_option_id IS NOT NULL;
    `);
    for (const [action, relation] of [
      ['read', 'organization'],
      ['read', 'admin'],
      ['create', 'groupMentor'],
      ['create', 'admin'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['location_option', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='location_option'",
    );
    await queryRunner.query(
      'ALTER TABLE photo DROP COLUMN IF EXISTS location_option_id',
    );
    await queryRunner.query('DROP TABLE IF EXISTS location_option');
  }
}
