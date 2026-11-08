import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActiveRole1792195200026 implements MigrationInterface {
  name = 'ActiveRole1792195200026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auth_session ADD COLUMN IF NOT EXISTS active_role_id text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auth_session DROP COLUMN IF EXISTS active_role_id`,
    );
  }
}
