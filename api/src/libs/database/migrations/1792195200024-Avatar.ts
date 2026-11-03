import { MigrationInterface, QueryRunner } from 'typeorm';

export class Avatar1792195200024 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE person ADD COLUMN avatar_file_id uuid REFERENCES file_record(id) ON DELETE SET NULL',
    );
    for (const action of ['read', 'update'])
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
       VALUES('avatar',$1,'*','self','detail') ON CONFLICT DO NOTHING`,
        [action],
      );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='avatar'",
    );
    await queryRunner.query('ALTER TABLE person DROP COLUMN avatar_file_id');
  }
}
