import { MigrationInterface, QueryRunner } from 'typeorm';

/** Superiors may read person identity at summary level (aggregates / roster). */
export class PersonAncestorSummary1792195200017 implements MigrationInterface {
  name = 'PersonAncestorSummary1792195200017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const relation of ['ancestor', 'supervisor', 'headMentor'] as const) {
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT 'person','read','*',$1::varchar,'summary'
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type='person' AND action='read'
             AND owner_role='*' AND viewer_relation=$1::varchar AND level='summary'
         )`,
        [relation],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM access_policy
       WHERE resource_type='person' AND action='read' AND owner_role='*'
         AND level='summary'
         AND viewer_relation IN ('ancestor','supervisor','headMentor')`,
    );
  }
}
