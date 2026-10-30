import { MigrationInterface, QueryRunner } from 'typeorm';

export class Camps1792195200010 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE camp (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        organizer_person_id uuid NOT NULL REFERENCES person(id),
        title varchar(200) NOT NULL,
        place varchar(200),
        purpose text,
        cost_amount int CHECK (cost_amount IS NULL OR (cost_amount >= 0 AND cost_amount <= 1000000000000)),
        duration_text varchar(100),
        starts_on date NOT NULL,
        ends_on date NOT NULL,
        schedule_text text,
        status varchar(30) NOT NULL DEFAULT 'draft'
          CHECK (status IN (
            'draft', 'permit_pending', 'permit_ok', 'registration',
            'running', 'finished', 'settled'
          )),
        price_per_person int
          CHECK (price_per_person IS NULL OR (price_per_person >= 0 AND price_per_person <= 1000000000000)),
        created_by uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_on >= starts_on)
      );
      CREATE INDEX camp_group_starts_idx ON camp(group_id, starts_on DESC, id);
      CREATE INDEX camp_organizer_idx ON camp(organizer_person_id);

      CREATE TABLE camp_participant (
        camp_id uuid NOT NULL REFERENCES camp(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES person(id),
        group_id uuid NOT NULL REFERENCES organization_group(id),
        status varchar(20) NOT NULL DEFAULT 'confirmed'
          CHECK (status IN ('invited', 'accepted', 'declined', 'confirmed')),
        PRIMARY KEY (camp_id, person_id)
      );
      CREATE INDEX camp_participant_person_idx ON camp_participant(person_id);
      CREATE INDEX camp_participant_group_idx ON camp_participant(group_id);

      CREATE TABLE camp_permit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        camp_id uuid NOT NULL UNIQUE REFERENCES camp(id) ON DELETE CASCADE,
        image_file_id uuid NOT NULL REFERENCES file_record(id),
        uploaded_by uuid NOT NULL REFERENCES person(id),
        status varchar(20) NOT NULL DEFAULT 'obtained'
          CHECK (status IN ('pending', 'obtained')),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE camp_notice (
        camp_id uuid PRIMARY KEY REFERENCES camp(id) ON DELETE CASCADE,
        meeting_time timestamptz,
        meeting_place varchar(200),
        items_to_bring text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE camp_schedule_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        camp_id uuid NOT NULL REFERENCES camp(id) ON DELETE CASCADE,
        day date NOT NULL,
        start_time time,
        end_time time,
        title varchar(200) NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX camp_schedule_item_camp_idx
        ON camp_schedule_item(camp_id, day, sort_order, id);
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'program_event'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'program_event_camp_id_fkey'
        ) THEN
          ALTER TABLE program_event
            ADD CONSTRAINT program_event_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES camp(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    for (const [action, relation] of [
      ['read', 'sameGroup'],
      ['read', 'groupMentor'],
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
        ['camp', action, '*', relation, 'detail'],
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'program_event_camp_id_fkey'
        ) THEN
          ALTER TABLE program_event DROP CONSTRAINT program_event_camp_id_fkey;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      "DELETE FROM access_policy WHERE resource_type='camp'",
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS camp_schedule_item, camp_notice, camp_permit, camp_participant, camp',
    );
  }
}
