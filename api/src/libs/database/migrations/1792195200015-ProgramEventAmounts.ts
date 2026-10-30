import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProgramEventAmounts1792195200015 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE program_event
        ADD COLUMN total_amount int NOT NULL DEFAULT 0
          CHECK (total_amount >= 0 AND total_amount <= 1000000000000),
        ADD COLUMN member_payment_amount int NOT NULL DEFAULT 0
          CHECK (member_payment_amount >= 0 AND member_payment_amount <= 1000000000000)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE program_event
        DROP COLUMN IF EXISTS member_payment_amount,
        DROP COLUMN IF EXISTS total_amount
    `);
  }
}
