import { ageOn } from '@safanoor/shared';
import { EntityManager } from 'typeorm';
import { rows } from '../libs/database/database.types';
import {
  demoBirthDate,
  demoFixtureId,
  DemoPerson,
  demoNotificationTypes,
  hoursAgo,
} from './fixtures';

export async function seedDemoProfiles(
  manager: EntityManager,
  people: DemoPerson[],
): Promise<void> {
  const fathers = [
    'رضا',
    'مجید',
    'حسن',
    'حسین',
    'مهدی',
    'عباس',
    'مسعود',
    'جواد',
  ];
  for (const person of people) {
    const marker = demoFixtureId(5, person.number);
    const inserted = await rows<{ id: string }>(
      manager,
      `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,'demo.loaded','person',$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        marker,
        person.id,
        hoursAgo(48 + person.number),
        JSON.stringify({ status: 'demo', fieldCount: 2 }),
      ],
    );
    if (!inserted.length || person.external || !person.birthDate) continue;
    await rows(
      manager,
      `UPDATE person SET father_name=CASE WHEN father_name='احمد' THEN $2 ELSE father_name END,
       birth_date=CASE WHEN to_char(birth_date,'MM-DD')='02-01' THEN $3::date ELSE birth_date END,
       updated_at=now() WHERE id=$1 AND verified_at IS NULL`,
      [
        person.id,
        fathers[person.number % fathers.length],
        demoBirthDate(ageOn(person.birthDate), person.number),
      ],
    );
    if (person.mentorId && person.number % 3 !== 0) {
      await rows(
        manager,
        `UPDATE person SET verified_at=$2,verified_by=$3 WHERE id=$1 AND verified_at IS NULL`,
        [person.id, hoursAgo(24 + person.number), person.mentorId],
      );
      await rows(
        manager,
        `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
         VALUES($1,$2,'person.verified','person',$3,$4,'{"status":"demo"}') ON CONFLICT(id) DO NOTHING`,
        [
          demoFixtureId(5, 100 + person.number),
          person.mentorId,
          person.id,
          hoursAgo(24 + person.number),
        ],
      );
    }
    if (person.number === 4)
      await rows(
        manager,
        `UPDATE person SET availability='unavailable' WHERE id=$1`,
        [person.id],
      );
  }
}

export async function seedDemoNotifications(
  manager: EntityManager,
  people: DemoPerson[],
): Promise<void> {
  for (const person of people) {
    const types = demoNotificationTypes(person);
    for (const [index, type] of types.entries()) {
      const createdAt = hoursAgo([0.5, 3, 20, 48, 120][index]);
      const notificationId = demoFixtureId(6, person.number * 10 + index);
      await rows(
        manager,
        `INSERT INTO notification(id,recipient_id,type,payload,created_at,read_at,dedupe_key)
         VALUES($1,$2,$3,'{"synthetic":true}',$4,$5,$6) ON CONFLICT DO NOTHING`,
        [
          notificationId,
          person.id,
          type,
          createdAt,
          index > 1 ? hoursAgo(index + 1) : null,
          `demo:v1:${person.id}:${type}`,
        ],
      );
      await rows(
        manager,
        `INSERT INTO notification_delivery(notification_id,status,delivered_at)
         SELECT id,'delivered',created_at FROM notification WHERE id=$1 ON CONFLICT DO NOTHING`,
        [notificationId],
      );
    }
  }
}
