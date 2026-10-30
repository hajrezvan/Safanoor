import { MigrationInterface, QueryRunner } from 'typeorm';

export class Finance1792195200009 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE program_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        kind varchar(20) NOT NULL CHECK (kind IN ('camp', 'custom')),
        title varchar(200) NOT NULL,
        camp_id uuid,
        held_at timestamptz,
        place varchar(200),
        notes text,
        created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX program_event_group_idx ON program_event(group_id, created_at DESC);
      CREATE INDEX program_event_group_kind_idx ON program_event(group_id, kind, created_at DESC);

      CREATE TABLE cost_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_type varchar(40) NOT NULL CHECK (owner_type IN ('program_event')),
        owner_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        amount int NOT NULL CHECK (amount >= 0 AND amount <= 1000000000000),
        per_person boolean NOT NULL DEFAULT false,
        created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX cost_item_owner_idx ON cost_item(owner_type, owner_id, created_at, id);
    `);
    for (const [action, relation] of [
      ['read', 'groupMentor'],
      ['read', 'financeOfficer'],
      ['create', 'groupMentor'],
      ['update', 'groupMentor'],
      ['manage', 'groupMentor'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['program_event', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='program_event'",
    );
    await queryRunner.query('DROP TABLE IF EXISTS cost_item');
    await queryRunner.query('DROP TABLE IF EXISTS program_event');
  }
}
