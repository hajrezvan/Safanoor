import { MigrationInterface, QueryRunner } from 'typeorm';
export class AssistantScheduling1792195200035 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level) VALUES
      ('session_attendance','create','*','groupMentor','detail'),
      ('camp_duty','update','*','responsibleAssistant','detail'),
      ('camp_duty','update','*','groupMentor','detail') ON CONFLICT DO NOTHING;`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM access_policy WHERE resource_type='camp_duty' OR (resource_type='session_attendance' AND action='create');`,
    );
  }
}
