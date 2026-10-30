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
  async deliverPending(): Promise<void> {
    await rows(
      this.db,
      "UPDATE notification_delivery SET status='delivered',delivered_at=now() WHERE channel='in_app' AND status='pending'",
    );
  }
}
