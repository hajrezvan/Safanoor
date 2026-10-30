import { MigrationInterface, QueryRunner } from 'typeorm';

export class Communications1792195200006 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chat_thread (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        kind varchar(10) NOT NULL CHECK (kind IN ('group', 'direct')),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX chat_thread_one_group
        ON chat_thread(group_id) WHERE kind = 'group';
      CREATE INDEX chat_thread_group_idx ON chat_thread(group_id, created_at DESC);

      CREATE TABLE chat_thread_participant (
        thread_id uuid NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id),
        PRIMARY KEY (thread_id, person_id)
      );
      CREATE INDEX chat_thread_participant_person_idx
        ON chat_thread_participant(person_id);

      CREATE TABLE chat_message (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id uuid NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES person(id),
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX chat_message_thread_idx
        ON chat_message(thread_id, created_at DESC, id);
    `);
    for (const [action, relation] of [
      ['read', 'attendee'],
      ['read', 'groupMentor'],
      ['create', 'attendee'],
      ['create', 'groupMentor'],
    ] as const)
      await queryRunner.query(
        `INSERT INTO access_policy(resource_type,action,owner_role,viewer_relation,level)
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM access_policy
           WHERE resource_type=$1::varchar AND action=$2::varchar
             AND owner_role=$3::varchar AND viewer_relation=$4::varchar
         )`,
        ['chat_thread', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='chat_thread'",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS chat_message, chat_thread_participant, chat_thread',
    );
  }
}
