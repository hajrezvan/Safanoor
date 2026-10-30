import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhotoAlbumTitle1792195200021 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE photo
        ADD COLUMN album_title varchar(200);
      CREATE INDEX photo_album_title_idx
        ON photo (host_group_id, album_title, created_at DESC);
    `);
    // Backfill: treat legacy per-photo titles as album names when present.
    await queryRunner.query(`
      UPDATE photo
      SET album_title = NULLIF(BTRIM(title), '')
      WHERE album_title IS NULL
        AND title IS NOT NULL
        AND BTRIM(title) <> '';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS photo_album_title_idx');
    await queryRunner.query(
      'ALTER TABLE photo DROP COLUMN IF EXISTS album_title',
    );
  }
}
