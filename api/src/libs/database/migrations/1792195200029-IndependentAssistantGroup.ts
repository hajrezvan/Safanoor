import { MigrationInterface, QueryRunner, QueryResult } from 'typeorm';

// A person's primary mentor is independent of the group where he assists.
function membershipValidation(requireSameGroup: boolean): string {
  return `CREATE OR REPLACE FUNCTION validate_membership() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_id uuid; member_count integer; person_row person%ROWTYPE;
    BEGIN
      IF TG_TABLE_NAME='person' THEN target_id:=NEW.id; ELSE target_id:=COALESCE(NEW.person_id,OLD.person_id); END IF;
      SELECT * INTO person_row FROM person WHERE id=target_id;
      SELECT count(*) INTO member_count FROM membership WHERE person_id=target_id AND role='member' AND valid_to IS NULL;
      IF person_row.status='active' AND NOT person_row.external AND person_row.org_level<>'supervisor' AND member_count<>1 THEN
        RAISE EXCEPTION 'exactly_one_active_member_required' USING ERRCODE='23514';
      END IF;
      IF person_row.org_level='supervisor' AND member_count<>0 THEN
        RAISE EXCEPTION 'supervisor_cannot_have_mentor' USING ERRCODE='23514';
      END IF;
      IF EXISTS(SELECT 1 FROM membership a WHERE a.person_id=target_id AND a.role='assistant' AND a.valid_to IS NULL
        AND NOT EXISTS(SELECT 1 FROM membership m WHERE m.person_id=a.person_id
          ${requireSameGroup ? 'AND m.group_id=a.group_id' : ''} AND m.role='member' AND m.valid_to IS NULL)) THEN
        RAISE EXCEPTION '${requireSameGroup ? 'assistant_requires_same_group_membership' : 'assistant_requires_primary_membership'}' USING ERRCODE='23514';
      END IF;
      RETURN NULL;
    END $$;`;
}

export class IndependentAssistantGroup1792195200029
  implements MigrationInterface
{
  name = 'IndependentAssistantGroup1792195200029';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT pg_advisory_xact_lock(739201)');
    await queryRunner.query(membershipValidation(false));
    await this.correctSeedMember(queryRunner, 27, 20);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT pg_advisory_xact_lock(739201)');
    await this.correctSeedMember(queryRunner, 20, 27);
    // Refuse a rollback that would leave other independent assignments invalid.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM membership a WHERE a.role='assistant' AND a.valid_to IS NULL
        AND NOT EXISTS(SELECT 1 FROM membership m WHERE m.person_id=a.person_id
          AND m.group_id=a.group_id AND m.role='member' AND m.valid_to IS NULL)) THEN
        RAISE EXCEPTION 'reassign_independent_assistants_before_rollback';
      END IF;
    END $$;`);
    await queryRunner.query(membershipValidation(true));
  }

  private async correctSeedMember(
    queryRunner: QueryRunner,
    from: number,
    to: number,
  ): Promise<void> {
    const personId = '40000000-0000-4000-8000-000000000012';
    const groupId = (n: number) =>
      `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    // Reserved fixture identity only. Ordinary organization records are untouched.
    const changed: QueryResult = await queryRunner.query(
      `UPDATE membership SET valid_to=now() WHERE person_id=$1 AND group_id=$2
        AND role='member' AND valid_to IS NULL
        AND EXISTS(SELECT 1 FROM person WHERE id=$1 AND first_name='محمدجواد' AND last_name='رضوانیان')
        AND EXISTS(SELECT 1 FROM organization_group WHERE id=$3)
       RETURNING person_id`,
      [personId, groupId(from), groupId(to)],
      true,
    );
    if (!changed.affected) return;
    await queryRunner.query(
      `INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')`,
      [personId, groupId(to)],
    );
    await queryRunner.query(
      `UPDATE follow_up_assignment SET to_date=now()
       WHERE member_person_id=$1 AND group_id=$2 AND to_date IS NULL`,
      [personId, groupId(from)],
    );
    await queryRunner.query(
      `UPDATE auth_session SET active_role_id=$2
       WHERE user_id IN (SELECT id FROM app_user WHERE person_id=$1) AND active_role_id=$3`,
      [personId, `member:${groupId(to)}`, `member:${groupId(from)}`],
    );
    await queryRunner.query('DELETE FROM person_ancestors');
    await queryRunner.query(`INSERT INTO person_ancestors
      WITH RECURSIVE c(person_id,ancestor_id,depth,path) AS (
        SELECT m.person_id,g.owner_person_id,1,ARRAY[m.person_id,g.owner_person_id]
        FROM membership m JOIN organization_group g ON g.id=m.group_id
        WHERE m.role='member' AND m.valid_to IS NULL
        UNION ALL
        SELECT c.person_id,g.owner_person_id,c.depth+1,c.path||g.owner_person_id
        FROM c JOIN membership m ON m.person_id=c.ancestor_id AND m.role='member' AND m.valid_to IS NULL
        JOIN organization_group g ON g.id=m.group_id WHERE NOT g.owner_person_id=ANY(c.path)
      ) SELECT person_id,ancestor_id,min(depth) FROM c GROUP BY person_id,ancestor_id`);
    await queryRunner.query(
      `INSERT INTO audit_log(action,resource_type,resource_id,meta)
       VALUES('membership.corrected','person',$1,$2)`,
      [
        personId,
        JSON.stringify({ reasonCode: 'owner_confirmed_primary_group' }),
      ],
    );
  }
}
