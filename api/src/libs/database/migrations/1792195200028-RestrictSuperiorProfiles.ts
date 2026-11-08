import { MigrationInterface, QueryRunner } from 'typeorm';

const SUPERIOR_RELATIONS = ['ancestor', 'supervisor', 'headMentor'];

/**
 * Superiors receive aggregate dashboards, not direct member identity profiles.
 * Keep this restriction in policy data so every API query gets the same result.
 */
export class RestrictSuperiorProfiles1792195200028
  implements MigrationInterface
{
  name = 'RestrictSuperiorProfiles1792195200028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM access_policy
       WHERE resource_type='person' AND action='read'
         AND viewer_relation=ANY($1::varchar[])`,
      [SUPERIOR_RELATIONS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const relation of SUPERIOR_RELATIONS)
      await queryRunner.query(
        `INSERT INTO access_policy(
           resource_type,action,owner_role,viewer_relation,level
         )
         VALUES('person','read','*',$1,'summary')
         ON CONFLICT(resource_type,action,owner_role,viewer_relation)
         DO UPDATE SET level=EXCLUDED.level`,
        [relation],
      );
  }
}
