import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectorReports1792195200031 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE app_user ADD COLUMN is_director boolean NOT NULL DEFAULT false',
    );
    await runner.query(`INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
      VALUES ('organization_report','read','*','director','detail')`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      "DELETE FROM access_policy WHERE resource_type='organization_report' AND viewer_relation='director'",
    );
    await runner.query('ALTER TABLE app_user DROP COLUMN is_director');
  }
}
