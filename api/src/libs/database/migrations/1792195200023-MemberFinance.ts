import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberFinance1792195200023 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
      VALUES('member_finance','read','*','self','detail') ON CONFLICT DO NOTHING`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='member_finance'",
    );
  }
}
