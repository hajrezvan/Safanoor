import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalIdentity1792195200004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'person'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%father_name%'
        LOOP
          EXECUTE format('ALTER TABLE person DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE person ADD CONSTRAINT person_identity_required_check
      CHECK (external OR (father_name IS NOT NULL AND birth_date IS NOT NULL AND national_id_enc IS NOT NULL AND national_id_hash IS NOT NULL))
    `);
  }
}
