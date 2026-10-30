import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import {
  ChatMessageDto,
  ChatMessagesPageDto,
  ChatThreadDto,
  ChatThreadsPageDto,
  PostChatMessageDto,
} from './communications.dto';

interface GroupScope {
  groupId: string;
  groupName: string;
  isMentor: boolean;
}

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
  ) {}

  async listThreads(
    actor: Actor,
    query: PaginationDto,
  ): Promise<ChatThreadsPageDto> {
    const scope = await this.scope(actor);
    await this.ensureThreads(actor, scope);
    const visible = scope.isMentor
      ? 't.group_id=$1'
      : `t.group_id=$1 AND EXISTS(
           SELECT 1 FROM chat_thread_participant p
           WHERE p.thread_id=t.id AND p.person_id=$2
         )`;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM chat_thread t WHERE ${visible}`,
      scope.isMentor ? [scope.groupId] : [scope.groupId, actor.personId],
    );
    const items = await rows<{
      id: string;
      kind: 'group' | 'direct';
      groupId: string;
      groupName: string;
      participants: { id: string; name: string; phone: string | null }[] | null;
      preview: string | null;
      lastMessageAt: string | null;
      messageCount: string;
      canPost: boolean;
    }>(
      this.db,
      `SELECT t.id,t.kind,t.group_id AS "groupId",
        g.name AS "groupName",
        (SELECT coalesce(json_agg(json_build_object(
              'id', p.id,
              'name', p.first_name||' '||p.last_name,
              'phone', p.phone
            ) ORDER BY p.first_name, p.last_name, p.id), '[]'::json)
           FROM chat_thread_participant cp JOIN person p ON p.id=cp.person_id
           WHERE cp.thread_id=t.id) AS participants,
        (SELECT m.body FROM chat_message m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS preview,
        (SELECT m.created_at::text FROM chat_message m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS "lastMessageAt",
        (SELECT count(*)::text FROM chat_message m WHERE m.thread_id=t.id) AS "messageCount",
        (EXISTS(SELECT 1 FROM chat_thread_participant cp WHERE cp.thread_id=t.id AND cp.person_id=$2) OR $3) AS "canPost"
       FROM chat_thread t
       JOIN organization_group g ON g.id=t.group_id
       WHERE ${visible}
       ORDER BY COALESCE(
         (SELECT m.created_at FROM chat_message m WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1),
         t.created_at
       ) DESC, t.id
       LIMIT $4 OFFSET $5`,
      [
        scope.groupId,
        actor.personId,
        scope.isMentor,
        query.limit,
        (query.page - 1) * query.limit,
      ],
    );
    return pageOf(
      items.map((item) => {
        const participants = item.participants ?? [];
        const title =
          item.kind === 'group'
            ? item.groupName
            : participants.map((p) => p.name).join(' ↔ ') || item.groupName;
        return {
          id: item.id,
          kind: item.kind,
          groupId: item.groupId,
          title,
          participants,
          preview: item.preview,
          lastMessageAt: item.lastMessageAt,
          messageCount: Number(item.messageCount ?? 0),
          canPost: item.canPost,
        } satisfies ChatThreadDto;
      }),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }

  async listMessages(
    actor: Actor,
    threadId: string,
    query: PaginationDto,
  ): Promise<ChatMessagesPageDto> {
    await this.access.require(
      actor,
      'read',
      await this.access.resolve('chat_thread', threadId, actor),
      'detail',
    );
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM chat_message WHERE thread_id=$1',
      [threadId],
    );
    const items = await rows<ChatMessageDto>(
      this.db,
      `SELECT m.id,m.thread_id AS "threadId",m.author_id AS "authorId",
        p.first_name||' '||p.last_name AS "authorName",m.body,
        m.created_at::text AS "createdAt", (m.author_id=$2) AS mine
       FROM chat_message m JOIN person p ON p.id=m.author_id
       WHERE m.thread_id=$1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $3 OFFSET $4`,
      [threadId, actor.personId, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(
      items.reverse(),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }

  async postMessage(
    actor: Actor,
    threadId: string,
    input: PostChatMessageDto,
  ): Promise<ChatMessageDto> {
    const resource = await this.access.resolve('chat_thread', threadId, actor);
    await this.access.require(actor, 'create', resource, 'detail');
    const body = normalizePersian(input.body.trim());
    if (!body) throw new BadRequestException('متن پیام را وارد کن.');
    const isParticipant = resource.attendeeIds?.includes(actor.personId);
    if (!isParticipant) {
      await rows(
        this.db,
        'INSERT INTO chat_thread_participant(thread_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [threadId, actor.personId],
      );
    }
    const created = await one<{ id: string; createdAt: string }>(
      this.db,
      'INSERT INTO chat_message(thread_id,author_id,body) VALUES($1,$2,$3) RETURNING id,created_at::text AS "createdAt"',
      [threadId, actor.personId, body],
    );
    if (!created) throw new BadRequestException();
    const author = await one<{ name: string }>(
      this.db,
      "SELECT first_name||' '||last_name AS name FROM person WHERE id=$1",
      [actor.personId],
    );
    return {
      id: created.id,
      threadId,
      authorId: actor.personId,
      authorName: author?.name ?? '',
      body,
      createdAt: created.createdAt,
      mine: true,
    };
  }

  private async scope(actor: Actor): Promise<GroupScope> {
    if (actor.isParent || actor.external)
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    const owned = await one<{ id: string; name: string }>(
      this.db,
      'SELECT id,name FROM organization_group WHERE owner_person_id=$1 ORDER BY name,id LIMIT 1',
      [actor.personId],
    );
    if (owned)
      return { groupId: owned.id, groupName: owned.name, isMentor: true };
    const membership = await one<{ id: string; name: string }>(
      this.db,
      `SELECT g.id,g.name FROM membership m
       JOIN organization_group g ON g.id=m.group_id
       WHERE m.person_id=$1 AND m.valid_to IS NULL
       ORDER BY CASE m.role WHEN 'assistant' THEN 0 ELSE 1 END, g.name, g.id
       LIMIT 1`,
      [actor.personId],
    );
    if (!membership)
      throw new ForbiddenException('عضویت گروهی برای مراودات پیدا نشد.');
    return {
      groupId: membership.id,
      groupName: membership.name,
      isMentor: false,
    };
  }

  private async ensureThreads(actor: Actor, scope: GroupScope): Promise<void> {
    await this.db.transaction(async (manager) => {
      let groupThread = await one<{ id: string }>(
        manager,
        "SELECT id FROM chat_thread WHERE group_id=$1 AND kind='group'",
        [scope.groupId],
      );
      if (!groupThread) {
        groupThread = await one<{ id: string }>(
          manager,
          "INSERT INTO chat_thread(group_id,kind) VALUES($1,'group') RETURNING id",
          [scope.groupId],
        );
      }
      if (!groupThread) throw new BadRequestException();
      await rows(
        manager,
        `INSERT INTO chat_thread_participant(thread_id,person_id)
         SELECT $1, g.owner_person_id FROM organization_group g WHERE g.id=$2
         ON CONFLICT DO NOTHING`,
        [groupThread.id, scope.groupId],
      );
      await rows(
        manager,
        `INSERT INTO chat_thread_participant(thread_id,person_id)
         SELECT $1, m.person_id FROM membership m
         WHERE m.group_id=$2 AND m.valid_to IS NULL
         ON CONFLICT DO NOTHING`,
        [groupThread.id, scope.groupId],
      );

      const pairs = await rows<{ assistantId: string; memberId: string }>(
        manager,
        scope.isMentor
          ? `SELECT f.assistant_person_id AS "assistantId", f.member_person_id AS "memberId"
             FROM follow_up_assignment f
             WHERE f.group_id=$1 AND f.to_date IS NULL`
          : actor.orgLevel === 'assistant'
            ? `SELECT f.assistant_person_id AS "assistantId", f.member_person_id AS "memberId"
               FROM follow_up_assignment f
               WHERE f.group_id=$1 AND f.to_date IS NULL AND f.assistant_person_id=$2`
            : `SELECT f.assistant_person_id AS "assistantId", f.member_person_id AS "memberId"
               FROM follow_up_assignment f
               WHERE f.group_id=$1 AND f.to_date IS NULL AND f.member_person_id=$2`,
        scope.isMentor
          ? [scope.groupId]
          : [scope.groupId, actor.personId],
      );

      for (const pair of pairs) {
        const existing = await one<{ id: string }>(
          manager,
          `SELECT t.id FROM chat_thread t
           WHERE t.group_id=$1 AND t.kind='direct'
             AND EXISTS(SELECT 1 FROM chat_thread_participant p WHERE p.thread_id=t.id AND p.person_id=$2)
             AND EXISTS(SELECT 1 FROM chat_thread_participant p WHERE p.thread_id=t.id AND p.person_id=$3)
             AND (SELECT count(*) FROM chat_thread_participant p WHERE p.thread_id=t.id)=2`,
          [scope.groupId, pair.assistantId, pair.memberId],
        );
        if (existing) continue;
        const created = await one<{ id: string }>(
          manager,
          "INSERT INTO chat_thread(group_id,kind) VALUES($1,'direct') RETURNING id",
          [scope.groupId],
        );
        if (!created) throw new NotFoundException();
        await rows(
          manager,
          'INSERT INTO chat_thread_participant(thread_id,person_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING',
          [created.id, pair.assistantId, pair.memberId],
        );
      }
    });
  }
}
