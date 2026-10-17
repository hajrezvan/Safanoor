import { MigrationInterface, QueryRunner } from 'typeorm';
import { foundationPolicies } from '../../../modules/access/policy.seed';

export class PolicySeed1792195200002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of foundationPolicies())
      await queryRunner.query(
        'INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level) VALUES($1,$2,$3,$4,$5)',
        [
          row.resourceType,
          row.action,
          row.ownerRole,
          row.viewerRelation,
          row.level,
        ],
      );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM access_policy');
  }
}
