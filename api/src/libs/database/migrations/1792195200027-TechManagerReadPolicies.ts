import { MigrationInterface, QueryRunner } from 'typeorm';

/** Broad read for technical manager (admin relation) during development. */
const ADMIN_READS: Array<[string, string]> = [
  ['consultation', 'read'],
  ['consultation_summary', 'read'],
  ['meeting', 'read'],
  ['photo', 'read'],
  ['chat_thread', 'read'],
  ['study_path', 'read'],
  ['lms_item', 'read'],
  ['program_event', 'read'],
  ['camp', 'read'],
];

export class TechManagerReadPolicies1792195200027
  implements MigrationInterface
{
  name = 'TechManagerReadPolicies1792195200027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [resourceType, action] of ADMIN_READS)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        [resourceType, action, '*', 'admin', 'detail'],
      );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [resourceType, action] of ADMIN_READS)
      await queryRunner.query(
        `DELETE FROM access_policy
         WHERE resource_type=$1 AND action=$2
           AND owner_role='*' AND viewer_relation='admin'`,
        [resourceType, action],
      );
  }
}
