import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import {
  DashboardCampCostDto,
  DashboardMeetingPreviewDto,
  DashboardMixItemDto,
  DashboardThreadPreviewDto,
  DashboardUpcomingCampDto,
  DashboardWeekCountDto,
  MentorDashboardDto,
} from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
  ) {}

  async mentor(actor: Actor): Promise<MentorDashboardDto> {
    await this.access.require(actor, 'read', { type: 'dashboard' });

    const owned = await rows<{ id: string; name: string }>(
      this.db,
      `SELECT id,name FROM organization_group
       WHERE owner_person_id=$1
         AND ($2::uuid IS NULL OR id=$2::uuid)
       ORDER BY name,id`,
      [
        actor.personId,
        actor.activeRoleKind === 'mentor' ? (actor.activeGroupId ?? null) : null,
      ],
    );
    // Hard isolation: mentor dashboard only when acting as mentor of a group.
    if (actor.activeRoleKind && actor.activeRoleKind !== 'mentor') {
      return emptyDashboard(null);
    }
    const groupIds = owned.map((g) => g.id);
    const primary = owned[0] ?? null;

    if (!groupIds.length) {
      return emptyDashboard(primary);
    }

    const [
      counts,
      consultationsByWeek,
      campCosts,
      upcomingCamps,
      recentMeetings,
      recentThreads,
    ] = await Promise.all([
      this.counts(actor.personId, groupIds),
      this.consultationsByWeek(groupIds),
      this.campCosts(groupIds),
      this.upcomingCamps(groupIds),
      this.recentMeetings(groupIds),
      this.recentThreads(actor.personId, groupIds),
    ]);

    const membershipMix: DashboardMixItemDto[] = [
      { key: 'verified', count: counts.verifiedCount },
      { key: 'unverified', count: counts.identityPendingCount },
      { key: 'assistant', count: counts.assistantCount },
    ];

    return {
      groupId: primary?.id ?? null,
      groupName: primary?.name ?? null,
      memberCount: counts.memberCount,
      assistantCount: counts.assistantCount,
      identityPendingCount: counts.identityPendingCount,
      recentConsultationsCount: counts.recentConsultationsCount,
      activeCampsCount: counts.activeCampsCount,
      totalExpenses: counts.totalExpenses,
      unreadNotifications: counts.unreadNotifications,
      pendingInvitesCount: counts.pendingInvitesCount,
      photoCount: counts.photoCount,
      consultationsByWeek,
      membershipMix,
      campCosts,
      upcomingCamps,
      recentMeetings,
      recentThreads,
    };
  }

  private async counts(personId: string, groupIds: string[]) {
    const result = await one<{
      memberCount: number;
      assistantCount: number;
      identityPendingCount: number;
      verifiedCount: number;
      recentConsultationsCount: number;
      activeCampsCount: number;
      totalExpenses: number;
      unreadNotifications: number;
      pendingInvitesCount: number;
      photoCount: number;
    }>(
      this.db,
      `SELECT
        (SELECT count(*)::int FROM person p
           JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
          WHERE p.status='active' AND p.org_level='member' AND m.group_id=ANY($1::uuid[])) AS "memberCount",
        (SELECT count(DISTINCT p.id)::int FROM person p
           JOIN membership m ON m.person_id=p.id AND m.role='assistant' AND m.valid_to IS NULL
          WHERE p.status='active' AND m.group_id=ANY($1::uuid[])) AS "assistantCount",
        (SELECT count(*)::int FROM person p
           JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
          WHERE p.status='active' AND p.org_level='member' AND p.verified_at IS NULL
            AND m.group_id=ANY($1::uuid[])) AS "identityPendingCount",
        (SELECT count(*)::int FROM person p
           JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
          WHERE p.status='active' AND p.org_level='member' AND p.verified_at IS NOT NULL
            AND m.group_id=ANY($1::uuid[])) AS "verifiedCount",
        (SELECT count(*)::int FROM consultation c
          WHERE c.group_id=ANY($1::uuid[]) AND c.held_at >= now() - interval '30 days')
          AS "recentConsultationsCount",
        (SELECT count(*)::int FROM camp c
          WHERE c.group_id=ANY($1::uuid[])
            AND c.status IN ('permit_pending','permit_ok','registration','running'))
          AS "activeCampsCount",
        (SELECT COALESCE(sum(pe.total_amount),0)::int FROM program_event pe
          WHERE pe.group_id=ANY($1::uuid[])) AS "totalExpenses",
        (SELECT count(*)::int FROM notification
          WHERE recipient_id=$2 AND read_at IS NULL) AS "unreadNotifications",
        (SELECT count(*)::int FROM assistant_invite
          WHERE group_id=ANY($1::uuid[]) AND status='pending') AS "pendingInvitesCount",
        (SELECT count(*)::int FROM photo p
           JOIN photo_group pg ON pg.photo_id=p.id
          WHERE pg.group_id=ANY($1::uuid[]) AND COALESCE(pg.hidden_by_group,false)=false)
          AS "photoCount"`,
      [groupIds, personId],
    );
    return (
      result ?? {
        memberCount: 0,
        assistantCount: 0,
        identityPendingCount: 0,
        verifiedCount: 0,
        recentConsultationsCount: 0,
        activeCampsCount: 0,
        totalExpenses: 0,
        unreadNotifications: 0,
        pendingInvitesCount: 0,
        photoCount: 0,
      }
    );
  }

  private async consultationsByWeek(
    groupIds: string[],
  ): Promise<DashboardWeekCountDto[]> {
    const weeks = await rows<{ weekStart: string; count: number }>(
      this.db,
      `WITH series AS (
         SELECT generate_series(
           date_trunc('week', now() - interval '7 weeks'),
           date_trunc('week', now()),
           interval '1 week'
         ) AS week_start
       )
       SELECT to_char(s.week_start,'YYYY-MM-DD') AS "weekStart",
              COALESCE(c.count,0)::int AS count
         FROM series s
         LEFT JOIN (
           SELECT date_trunc('week', held_at) AS week_start, count(*)::int AS count
             FROM consultation
            WHERE group_id=ANY($1::uuid[])
              AND held_at >= date_trunc('week', now() - interval '7 weeks')
            GROUP BY 1
         ) c ON c.week_start = s.week_start
        ORDER BY s.week_start`,
      [groupIds],
    );
    return weeks;
  }

  private async campCosts(groupIds: string[]): Promise<DashboardCampCostDto[]> {
    return rows<DashboardCampCostDto>(
      this.db,
      `SELECT pe.id, pe.title, pe.total_amount AS amount
         FROM program_event pe
        WHERE pe.group_id=ANY($1::uuid[]) AND pe.total_amount > 0
        ORDER BY pe.total_amount DESC, pe.created_at DESC
        LIMIT 6`,
      [groupIds],
    );
  }

  private async upcomingCamps(
    groupIds: string[],
  ): Promise<DashboardUpcomingCampDto[]> {
    return rows<DashboardUpcomingCampDto>(
      this.db,
      `SELECT id, title, starts_on::text AS "startsOn", status
         FROM camp
        WHERE group_id=ANY($1::uuid[])
          AND status NOT IN ('finished','settled')
          AND ends_on >= CURRENT_DATE
        ORDER BY starts_on ASC, id
        LIMIT 5`,
      [groupIds],
    );
  }

  private async recentMeetings(
    groupIds: string[],
  ): Promise<DashboardMeetingPreviewDto[]> {
    return rows<DashboardMeetingPreviewDto>(
      this.db,
      `SELECT id, title, held_at::text AS "heldAt"
         FROM meeting
        WHERE group_id=ANY($1::uuid[])
        ORDER BY held_at DESC, id
        LIMIT 5`,
      [groupIds],
    );
  }

  private async recentThreads(
    personId: string,
    groupIds: string[],
  ): Promise<DashboardThreadPreviewDto[]> {
    return rows<DashboardThreadPreviewDto>(
      this.db,
      `SELECT t.id,
        CASE
          WHEN t.kind='group' THEN g.name
          ELSE COALESCE(
            (SELECT string_agg(p.first_name||' '||p.last_name, '، ' ORDER BY p.first_name)
               FROM chat_thread_participant cp JOIN person p ON p.id=cp.person_id
              WHERE cp.thread_id=t.id AND cp.person_id<>$2),
            g.name
          )
        END AS title,
        (SELECT m.body FROM chat_message m
          WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS preview,
        (SELECT m.created_at::text FROM chat_message m
          WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS "lastMessageAt"
       FROM chat_thread t
       JOIN organization_group g ON g.id=t.group_id
       WHERE t.group_id=ANY($1::uuid[])
       ORDER BY COALESCE(
         (SELECT m.created_at FROM chat_message m
           WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1),
         t.created_at
       ) DESC, t.id
       LIMIT 5`,
      [groupIds, personId],
    );
  }
}

function emptyDashboard(
  primary: { id: string; name: string } | null,
): MentorDashboardDto {
  return {
    groupId: primary?.id ?? null,
    groupName: primary?.name ?? null,
    memberCount: 0,
    assistantCount: 0,
    identityPendingCount: 0,
    recentConsultationsCount: 0,
    activeCampsCount: 0,
    totalExpenses: 0,
    unreadNotifications: 0,
    pendingInvitesCount: 0,
    photoCount: 0,
    consultationsByWeek: [],
    membershipMix: [
      { key: 'verified', count: 0 },
      { key: 'unverified', count: 0 },
      { key: 'assistant', count: 0 },
    ],
    campCosts: [],
    upcomingCamps: [],
    recentMeetings: [],
    recentThreads: [],
  };
}
