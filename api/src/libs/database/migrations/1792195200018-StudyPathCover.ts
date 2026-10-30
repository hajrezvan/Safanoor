import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudyPathCover1792195200018 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE study_path
        ADD COLUMN IF NOT EXISTS cover_file_id uuid REFERENCES file_record(id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE study_path DROP COLUMN IF EXISTS cover_file_id',
    );
  }
}
