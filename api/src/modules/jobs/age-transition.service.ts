import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AgeTransitionService {
  constructor(
    private readonly db: DataSource,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}
  async run(at = new Date()): Promise<void> {
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739204)');
      const links = await rows<{
        id: string;
        childId: string;
        parentId: string;
        adult: boolean;
        soon: boolean;
        warned: boolean;
      }>(
        manager,
        `SELECT l.id,l.child_person_id AS "childId",u.person_id AS "parentId",p.birth_date+interval '18 years'<=$1::date AS adult,p.birth_date+interval '18 years'<=$1::date+interval '30 days' AS soon,(l.warned_at IS NOT NULL) AS warned FROM parent_link l JOIN person p ON p.id=l.child_person_id JOIN app_user u ON u.id=l.parent_user_id WHERE l.active AND p.status='active' FOR UPDATE OF l`,
        [at.toISOString().slice(0, 10)],
      );
      for (const link of links) {
        if (link.adult) {
          await rows(
            manager,
            'UPDATE parent_link SET active=false,archived_at=$2 WHERE id=$1',
            [link.id, at],
          );
          await rows(
            manager,
            'UPDATE person SET consent_required=true WHERE id=$1',
            [link.childId],
          );
          for (const recipient of [link.childId, link.parentId])
            await this.notifications.create(
              recipient,
              'age18.transition',
              `adult:${link.id}:${recipient}`,
              manager,
            );
          await this.audit.record(
            null,
            'parent_link.archived',
            'person',
            link.childId,
            { reasonCode: 'age18' },
            manager,
          );
        } else if (link.soon && !link.warned) {
          await rows(
            manager,
            'UPDATE parent_link SET warned_at=$2 WHERE id=$1',
            [link.id, at],
          );
          for (const recipient of [link.childId, link.parentId])
            await this.notifications.create(
              recipient,
              'age18.warning',
              `age-warning:${link.id}:${recipient}`,
              manager,
            );
        }
      }
      await rows(manager, "SELECT set_config('app.worker','on',true)");
      const retention = await one<{ keepDays: number }>(
        manager,
        'SELECT keep_days AS "keepDays" FROM retention_policy WHERE data_type=\'temporary_upload\'',
      );
      await rows(
        manager,
        "DELETE FROM import_row WHERE job_id IN (SELECT id FROM import_job WHERE status IN ('completed','invalid','failed') AND updated_at<$1::timestamptz-($2*interval '1 day'))",
        [at, retention?.keepDays ?? 3],
      );
    });
  }
}
