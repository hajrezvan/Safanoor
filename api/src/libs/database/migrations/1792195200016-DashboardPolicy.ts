import { MigrationInterface, QueryRunner } from 'typeorm';

export class DashboardPolicy1792195200016 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const relation of ['groupMentor', 'admin'] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['dashboard', 'read', '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='dashboard'",
    );
  }
}
