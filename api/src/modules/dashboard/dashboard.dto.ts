import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardWeekCountDto {
  @ApiProperty({ description: 'ISO date of week start (UTC)' })
  weekStart!: string;
  @ApiProperty() count!: number;
}

export class DashboardMixItemDto {
  @ApiProperty({ enum: ['verified', 'unverified', 'assistant'] })
  key!: 'verified' | 'unverified' | 'assistant';
  @ApiProperty() count!: number;
}

export class DashboardCampCostDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() amount!: number;
}

export class DashboardUpcomingCampDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() startsOn!: string;
  @ApiProperty() status!: string;
}

export class DashboardMeetingPreviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() heldAt!: string;
}

export class DashboardThreadPreviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  preview!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  lastMessageAt!: string | null;
}

export class MentorDashboardDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  groupId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  groupName!: string | null;
  @ApiProperty() memberCount!: number;
  @ApiProperty() assistantCount!: number;
  @ApiProperty() identityPendingCount!: number;
  @ApiProperty() recentConsultationsCount!: number;
  @ApiProperty() activeCampsCount!: number;
  @ApiProperty() totalExpenses!: number;
  @ApiProperty() unreadNotifications!: number;
  @ApiProperty() pendingInvitesCount!: number;
  @ApiProperty() photoCount!: number;
  @ApiProperty({ type: [DashboardWeekCountDto] })
  consultationsByWeek!: DashboardWeekCountDto[];
  @ApiProperty({ type: [DashboardMixItemDto] })
  membershipMix!: DashboardMixItemDto[];
  @ApiProperty({ type: [DashboardCampCostDto] })
  campCosts!: DashboardCampCostDto[];
  @ApiProperty({ type: [DashboardUpcomingCampDto] })
  upcomingCamps!: DashboardUpcomingCampDto[];
  @ApiProperty({ type: [DashboardMeetingPreviewDto] })
  recentMeetings!: DashboardMeetingPreviewDto[];
  @ApiProperty({ type: [DashboardThreadPreviewDto] })
  recentThreads!: DashboardThreadPreviewDto[];
}
