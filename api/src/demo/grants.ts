import { EntityManager } from 'typeorm';
import { one, rows } from '../libs/database/database.types';
import { demoId } from '../seed';
import { demoFixtureId, hoursAgo } from './fixtures';

export async function seedDemoGrants(manager: EntityManager): Promise<void> {
  for (const [index, member, mentor, revoked] of [
    [1, 11, 3, false],
    [2, 17, 4, false],
    [3, 12, 3, true],
  ] as const) {
    const resourceId = demoFixtureId(8, index);
    const grantId = demoFixtureId(7, index);
    const relation = await one<{ groupId: string }>(
      manager,
      `SELECT g.id AS "groupId" FROM membership m JOIN organization_group g ON g.id=m.group_id
       JOIN person p ON p.id=m.person_id WHERE p.id=$1 AND p.status='active' AND m.role='member'
       AND m.valid_to IS NULL AND g.owner_person_id=$2`,
      [demoId(member), demoId(mentor)],
    );
    if (!relation) continue;
    await rows(
      manager,
      `INSERT INTO resource_registry(resource_type,resource_id,member_person_id,owner_person_id,owner_role,group_ids)
       VALUES('person_file',$1,$2,$3,'mentor',$4) ON CONFLICT DO NOTHING`,
      [resourceId, demoId(member), demoId(mentor), [relation.groupId]],
    );
    await rows(
      manager,
      `INSERT INTO access_grant(id,resource_type,resource_id,member_person_id,grantee_person_id,
       granted_by,granted_at,revoked_at,reason) VALUES($1,'person_file',$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO NOTHING`,
      [
        grantId,
        resourceId,
        demoId(member),
        demoId(1),
        demoId(mentor),
        hoursAgo(24 * (index + 1)),
        revoked ? hoursAgo(12) : null,
        'ارجاع آزمایشی برای نمایش روند بررسی پرونده',
      ],
    );
    await rows(
      manager,
      `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,'grant.created','person_file',$3,$4,'{"status":"demo"}') ON CONFLICT(id) DO NOTHING`,
      [
        demoFixtureId(5, 2000 + index),
        demoId(mentor),
        resourceId,
        hoursAgo(24 * (index + 1)),
      ],
    );
    if (revoked)
      await rows(
        manager,
        `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,'grant.revoked','person_file',$3,$4,'{"status":"demo"}') ON CONFLICT(id) DO NOTHING`,
        [
          demoFixtureId(5, 2100 + index),
          demoId(mentor),
          resourceId,
          hoursAgo(12),
        ],
      );
  }
}
