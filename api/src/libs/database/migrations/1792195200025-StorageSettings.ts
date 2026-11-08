import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorageSettings1792195200025 implements MigrationInterface {
  name = 'StorageSettings1792195200025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE storage_settings (
        id boolean PRIMARY KEY DEFAULT true CHECK (id),
        mode text NOT NULL DEFAULT 'local' CHECK (mode IN ('local','remote')),
        endpoint text,
        public_endpoint text,
        bucket text,
        region text,
        access_key text,
        secret_key_enc text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid REFERENCES person(id)
      );
    `);
    await queryRunner.query(
      `INSERT INTO storage_settings(id, mode) VALUES (true, 'local') ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS storage_settings`);
  }
}
