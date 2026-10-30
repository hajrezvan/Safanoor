'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatNumber } from '@safanoor/shared';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Card,
  Chip,
  Grid,
  Row,
  Text,
  Stack,
  Button,
  Section,
  StatCard,
  FeedItem,
  EmptyState,
  QueryState,
  Spread,
  CardNav,
  BarSeriesChart,
  DonutChart,
} from 'src/components/ui';

type MentorDashboard = components['schemas']['MentorDashboardDto'];

function campStatusLabel(status: string, t: ReturnType<typeof useFa>) {
  const key = `campStatus_${status}` as TextKey;
  const label = t(key);
  return label === key ? status : label;
}

function mixLabel(key: string, t: ReturnType<typeof useFa>): string {
  if (key === 'verified') return t('dashboardMixVerified');
  if (key === 'unverified') return t('dashboardMixUnverified');
  if (key === 'assistant') return t('dashboardMixAssistant');
  return key;
}

function weekLabel(weekStart: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Tehran',
    }).format(new Date(weekStart));
  } catch {
    return weekStart;
  }
}

function MentorDashboardBody({ data }: { data: MentorDashboard }) {
  const t = useFa();
  const router = useRouter();
  const hasLists =
    data.upcomingCamps.length > 0 ||
    data.recentMeetings.length > 0 ||
    data.recentThreads.length > 0;

  return (
    <Section>
      <Grid>
        <StatCard
          title={t('dashboardMembers')}
          value={data.memberCount}
          icon="people"
          href="/admin/people"
        />
        <StatCard
          title={t('dashboardIdentityPending')}
          value={data.identityPendingCount}
          icon="profile"
          href="/admin/people"
        />
        <StatCard
          title={t('dashboardRecentConsultations')}
          value={data.recentConsultationsCount}
          icon="consultations"
          href="/consultations"
        />
        <StatCard
          title={t('dashboardActiveCamps')}
          value={data.activeCampsCount}
          icon="campAttendance"
          href="/camp-attendance"
        />
        <StatCard
          title={t('dashboardTotalExpenses')}
          value={data.totalExpenses}
          icon="finance"
          href="/finance"
        />
        <StatCard
          title={t('dashboardUnread')}
          value={data.unreadNotifications}
          icon="notifications"
          href="/notifications"
        />
      </Grid>

      <Card>
        <Stack>
          <Text variant="subtitle">{t('dashboardShortcuts')}</Text>
          <Row>
            <Button href="/admin/people" variant="outlined">
              {t('myGroup')}
            </Button>
            <Button href="/consultations" variant="outlined">
              {t('consultations')}
            </Button>
            <Button href="/finance" variant="outlined">
              {t('finance')}
            </Button>
            <Button href="/camp-attendance" variant="outlined">
              {t('campAttendance')}
            </Button>
            <Button href="/communications" variant="outlined">
              {t('communications')}
            </Button>
            <Button href="/meetings" variant="outlined">
              {t('meetings')}
            </Button>
          </Row>
        </Stack>
      </Card>

      {(data.pendingInvitesCount > 0 ||
        data.photoCount > 0 ||
        data.assistantCount > 0) && (
        <Row>
          {data.assistantCount > 0 && (
            <Chip>
              {t('dashboardAssistantsChip', {
                count: formatNumber(data.assistantCount),
              })}
            </Chip>
          )}
          {data.pendingInvitesCount > 0 && (
            <Chip tone="warning">
              {t('dashboardPendingInvites', {
                count: formatNumber(data.pendingInvitesCount),
              })}
            </Chip>
          )}
          {data.photoCount > 0 && (
            <Chip>
              {t('dashboardPhotoCount', {
                count: formatNumber(data.photoCount),
              })}
            </Chip>
          )}
        </Row>
      )}

      <Grid>
        <BarSeriesChart
          title={t('dashboardConsultationsChart')}
          labels={data.consultationsByWeek.map((week) => weekLabel(week.weekStart))}
          values={data.consultationsByWeek.map((week) => week.count)}
          emptyTitle={t('dashboardChartEmpty')}
          emptyHint={t('dashboardConsultationsChartEmpty')}
        />
        <DonutChart
          title={t('dashboardMembershipMix')}
          items={data.membershipMix.map((item) => ({
            id: item.key,
            label: mixLabel(item.key, t),
            value: item.count,
          }))}
          emptyTitle={t('dashboardChartEmpty')}
          emptyHint={t('dashboardMembershipMixEmpty')}
        />
        <BarSeriesChart
          title={t('dashboardCampCostsChart')}
          labels={data.campCosts.map((item) => item.title)}
          values={data.campCosts.map((item) => item.amount)}
          emptyTitle={t('dashboardChartEmpty')}
          emptyHint={t('dashboardCampCostsEmpty')}
        />
      </Grid>

      {hasLists ? (
        <Grid>
          <Card>
            <Stack>
              <Spread>
                <Text variant="subtitle">{t('dashboardUpcomingCamps')}</Text>
                <Button href="/camp-attendance" variant="text">
                  {t('dashboardSeeAll')}
                </Button>
              </Spread>
              {data.upcomingCamps.length === 0 ? (
                <EmptyState
                  title={t('dashboardNoCamps')}
                  hint={t('dashboardNoCampsHint')}
                />
              ) : (
                data.upcomingCamps.map((camp) => (
                  <CardNav key={camp.id} href="/camp-attendance" label={camp.title}>
                    <Stack>
                      <Spread>
                        <Text variant="subtitle">{camp.title}</Text>
                        <Chip>{campStatusLabel(camp.status, t)}</Chip>
                      </Spread>
                      <Text muted variant="caption">
                        {formatDate(camp.startsOn)}
                      </Text>
                    </Stack>
                  </CardNav>
                ))
              )}
            </Stack>
          </Card>

          <Card>
            <Stack>
              <Spread>
                <Text variant="subtitle">{t('dashboardRecentMeetings')}</Text>
                <Button href="/meetings" variant="text">
                  {t('dashboardSeeAll')}
                </Button>
              </Spread>
              {data.recentMeetings.length === 0 ? (
                <EmptyState
                  title={t('dashboardNoMeetings')}
                  hint={t('dashboardNoMeetingsHint')}
                />
              ) : (
                data.recentMeetings.map((meeting) => (
                  <CardNav
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    label={meeting.title}
                  >
                    <Stack>
                      <Text variant="subtitle">{meeting.title}</Text>
                      <Text muted variant="caption">
                        {formatDate(meeting.heldAt, true)}
                      </Text>
                    </Stack>
                  </CardNav>
                ))
              )}
            </Stack>
          </Card>

          <Card>
            <Stack>
              <Spread>
                <Text variant="subtitle">{t('dashboardRecentThreads')}</Text>
                <Button href="/communications" variant="text">
                  {t('dashboardSeeAll')}
                </Button>
              </Spread>
              {data.recentThreads.length === 0 ? (
                <EmptyState
                  title={t('communicationsEmpty')}
                  hint={t('communicationsEmptyHint')}
                />
              ) : (
                data.recentThreads.map((thread) => (
                  <FeedItem
                    key={thread.id}
                    title={
                      thread.preview
                        ? `${thread.title} — ${thread.preview}`
                        : thread.title
                    }
                    time={
                      thread.lastMessageAt
                        ? formatDate(thread.lastMessageAt, true)
                        : t('empty')
                    }
                    unread={false}
                    onRead={() => {
                      router.push('/communications');
                    }}
                  />
                ))
              )}
            </Stack>
          </Card>
        </Grid>
      ) : (
        <Card>
          <EmptyState
            title={t('dashboardListsEmpty')}
            hint={t('dashboardListsEmptyHint')}
            action={
              <Row>
                <Button href="/camp-attendance" variant="outlined">
                  {t('campAttendance')}
                </Button>
                <Button href="/meetings" variant="outlined">
                  {t('meetings')}
                </Button>
                <Button href="/communications" variant="outlined">
                  {t('communications')}
                </Button>
              </Row>
            }
          />
        </Card>
      )}
    </Section>
  );
}

export function MentorHomeDashboard({ name }: { name: string }) {
  const t = useFa();
  const query = useQuery({
    queryKey: ['dashboard', 'mentor'],
    queryFn: api.mentorDashboard,
  });

  return (
    <QueryState
      loading={query.isLoading}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data && (
        <>
          <Card>
            <Stack>
              <Spread>
                <Stack>
                  <Chip>{t('hello', { name })}</Chip>
                  <Text variant="title">{t('mentorDashboardTitle')}</Text>
                  <Text muted>
                    {query.data.groupName
                      ? t('mentorDashboardHint', { group: query.data.groupName })
                      : t('mentorDashboardHintEmpty')}
                  </Text>
                </Stack>
                {query.data.groupName && (
                  <Chip tone="success">{query.data.groupName}</Chip>
                )}
              </Spread>
            </Stack>
          </Card>
          <MentorDashboardBody data={query.data} />
        </>
      )}
    </QueryState>
  );
}
