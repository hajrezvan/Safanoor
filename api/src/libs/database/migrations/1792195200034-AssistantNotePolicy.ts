import { MigrationInterface, QueryRunner } from 'typeorm';
export class AssistantNotePolicy1792195200034 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM access_policy WHERE resource_type='consultation_private_note' AND owner_role='assistant' AND viewer_relation='mentor';
      INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
      VALUES('consultation_private_note','read','assistant','groupMentor','detail') ON CONFLICT DO NOTHING;`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM access_policy WHERE resource_type='consultation_private_note' AND owner_role='assistant' AND viewer_relation='groupMentor';
      INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
      VALUES('consultation_private_note','read','assistant','mentor','detail') ON CONFLICT DO NOTHING;`);
  }
}
