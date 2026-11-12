import { MigrationInterface, QueryRunner } from 'typeorm';
export class ReadingPages1792195200030 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE study_path_item ADD COLUMN total_pages integer CHECK(total_pages BETWEEN 1 AND 100000);
      ALTER TABLE study_path_reading ADD COLUMN current_page integer NOT NULL DEFAULT 0 CHECK(current_page>=0);
      CREATE TABLE study_reading_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES study_path_item(id) ON DELETE CASCADE,
        from_page integer NOT NULL CHECK(from_page>=0), to_page integer NOT NULL CHECK(to_page>=0),
        delta integer GENERATED ALWAYS AS (to_page-from_page) STORED,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        reading_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Tehran')::date)
      ); CREATE INDEX reading_event_person_item_day ON study_reading_event(person_id,item_id,reading_day);`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE study_reading_event; ALTER TABLE study_path_reading DROP COLUMN current_page; ALTER TABLE study_path_item DROP COLUMN total_pages;',
    );
  }
}
