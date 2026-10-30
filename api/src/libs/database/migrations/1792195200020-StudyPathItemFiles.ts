import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudyPathItemFiles1792195200020 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE study_path_item
        ADD COLUMN IF NOT EXISTS cover_file_id uuid REFERENCES file_record(id),
        ADD COLUMN IF NOT EXISTS pdf_file_id uuid REFERENCES file_record(id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE study_path_item
        DROP COLUMN IF EXISTS cover_file_id,
        DROP COLUMN IF EXISTS pdf_file_id
    `);
  }
}
