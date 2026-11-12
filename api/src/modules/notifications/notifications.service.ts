import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Database,
  one,
  pageOf,
  rows,
} from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';

export interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
  ) {}
  async create(
    recipientId: string,
    type: string,
    dedupeKey?: string,
    transaction: Database = this.db,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const notification = await one<{ id: string }>(
      transaction,
      'INSERT INTO notification(recipient_id,type,dedupe_key,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id',
      [recipientId, type, dedupeKey ?? null, JSON.stringify(payload)],
    );
    if (notification)
      await rows(
        transaction,
        'INSERT INTO notification_delivery(notification_id) VALUES($1) ON CONFLICT DO NOTHING',
        [notification.id],
      );
  }
  async list(actor: Actor, query: PaginationDto) {
    await this.access.require(actor, 'read', {
      type: 'notification',
      ownerId: actor.personId,
    });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM notification WHERE recipient_id=$1',
      [actor.personId],
    );
    const items = await rows<NotificationRow>(
      this.db,
      'SELECT id,type,payload,created_at AS "createdAt",read_at AS "readAt" FROM notification WHERE recipient_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',
      [actor.personId, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async markRead(actor: Actor, id: string): Promise<void> {
    await this.access.require(
      actor,
      'update',
      await this.access.resolve('notification', id, actor),
    );
    await rows(
      this.db,
      'UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND recipient_id=$2',
      [id, actor.personId],
    );
  }
  /** Trusted worker: current assignments are rechecked before queuing each reminder. */
  async remindFollowUps(): Promise<void> {
    const due = await rows<{
      id: string;
      memberId: string;
      assistantId: string;
      groupId: string;
      userId: string;
    }>(
      this.db,
      `
      SELECT i.id,i.member_id AS "memberId",f.assistant_person_id AS "assistantId",i.group_id AS "groupId",u.id AS "userId"
      FROM follow_up_item i JOIN follow_up_assignment f ON f.member_person_id=i.member_id AND f.group_id=i.group_id AND f.to_date IS NULL
      JOIN membership membership ON membership.person_id=f.assistant_person_id AND membership.group_id=f.group_id AND membership.role='assistant' AND membership.valid_to IS NULL
      JOIN person member ON member.id=i.member_id AND member.status='active'
      JOIN membership primary_member ON primary_member.person_id=member.id AND primary_member.group_id=i.group_id AND primary_member.role='member' AND primary_member.valid_to IS NULL
      JOIN person assistant ON assistant.id=f.assistant_person_id AND assistant.status='active' AND NOT assistant.consent_required
      JOIN app_user u ON u.person_id=assistant.id
      WHERE i.completed_at IS NULL AND i.due_at<=now() AND NOT EXISTS (
        SELECT 1 FROM notification n WHERE n.dedupe_key='followup-due:'||i.id::text||':'||f.assistant_person_id::text
      ) ORDER BY i.due_at,i.id LIMIT 100`,
    );
    for (const item of due) {
      const actor: Actor = {
        personId: item.assistantId,
        userId: item.userId,
        isAdmin: false,
        isParent: false,
        external: false,
        orgLevel: 'assistant',
        status: 'active',
        consentRequired: false,
        activeRoleKind: 'assistant',
        activeGroupId: item.groupId,
      };
      if (
        (await this.access.level(actor, 'read', {
          type: 'assistant_workspace',
          groupIds: [item.groupId],
        })) === 'none'
      )
        continue;
      await this.create(
        item.assistantId,
        'followup.due',
        `followup-due:${item.id}:${item.assistantId}`,
        this.db,
        { itemId: item.id, memberId: item.memberId },
      );
    }
  }
  async deliverPending(): Promise<void> {
    await rows(
      this.db,
      "UPDATE notification_delivery SET status='delivered',delivered_at=now() WHERE channel='in_app' AND status='pending'",
    );
  }
}
