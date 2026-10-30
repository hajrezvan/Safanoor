import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssistantInvite1792195200005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE assistant_invite (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        mentor_person_id uuid NOT NULL REFERENCES person(id),
        invitee_person_id uuid NOT NULL REFERENCES person(id),
        status varchar(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','rejected')),
        created_at timestamptz NOT NULL DEFAULT now(),
        responded_at timestamptz,
        CHECK (mentor_person_id <> invitee_person_id),
        CHECK (
          (status = 'pending' AND responded_at IS NULL)
          OR (status <> 'pending' AND responded_at IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX one_pending_assistant_invite
        ON assistant_invite(group_id, invitee_person_id)
        WHERE status = 'pending';
      CREATE INDEX assistant_invite_group_idx ON assistant_invite(group_id, created_at DESC);
      CREATE INDEX assistant_invite_invitee_idx ON assistant_invite(invitee_person_id, status);
    `);
    for (const [action, relation] of [
      ['create', 'groupMentor'],
      ['read', 'groupMentor'],
      ['read', 'self'],
      ['update', 'self'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['assistant_invite', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='assistant_invite'",
    );
    await queryRunner.query('DROP TABLE IF EXISTS assistant_invite');
  }
}
