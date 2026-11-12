import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampStaffOnly1792195200032 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      "DELETE FROM access_policy WHERE resource_type='camp' AND action='read' AND viewer_relation='sameGroup'",
    );
    await runner.query(
      "INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level) VALUES ('camp','read','*','campStaff','detail') ON CONFLICT (resource_type,action,owner_role,viewer_relation) DO UPDATE SET level=EXCLUDED.level",
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      "DELETE FROM access_policy WHERE resource_type='camp' AND action='read' AND viewer_relation='campStaff'",
    );
    await runner.query(
      "INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level) VALUES ('camp','read','*','sameGroup','detail') ON CONFLICT (resource_type,action,owner_role,viewer_relation) DO NOTHING",
    );
  }
}
