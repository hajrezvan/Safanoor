import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudyReading1792195200022 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE study_path_reading (
        item_id uuid NOT NULL REFERENCES study_path_item(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        status varchar(20) NOT NULL CHECK (status IN ('reading','completed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (person_id,item_id)
      );
      CREATE INDEX study_path_reading_item_idx ON study_path_reading(item_id);
    `);
    for (const action of ['read', 'update'])
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         VALUES ('study_reading',$1,'*','self','detail') ON CONFLICT DO NOTHING`,
        [action],
      );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='study_reading'",
    );
    await queryRunner.query('DROP TABLE study_path_reading');
  }
}
