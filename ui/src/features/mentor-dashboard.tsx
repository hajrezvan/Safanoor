'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatNumber, formatCompactStamp } from '@safanoor/shared';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Card,
  Hero,
  Chip,
  Grid,
  Text,
  Stack,
  Button,
  Spread,
  Section,
  CardNav,
  StatCard,
  FeedItem,
  StatsGrid,
  EmptyState,
  QueryState,
  DonutChart,
  QuickAccess,
  BarSeriesChart,
} from 'src/components/ui';

import { useSession } from './session';
import { AssistantSessionCreator } from './assistant-dashboard';

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
      <StatsGrid>
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
      </StatsGrid>

      {(data.pendingInvitesCount > 0 || data.photoCount > 0 || data.assistantCount > 0) && (
        <Row>
          {data.assistantCount > 0 && (
            <Chip href="/admin/people?tab=coaching">
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
          integerTicks
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
                <EmptyState title={t('dashboardNoCamps')} hint={t('dashboardNoCampsHint')} />
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
                <EmptyState title={t('dashboardNoMeetings')} hint={t('dashboardNoMeetingsHint')} />
              ) : (
                data.recentMeetings.map((meeting) => (
                  <CardNav key={meeting.id} href={`/meetings/${meeting.id}`} label={meeting.title}>
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
              {(() => {
                const threadsWithMessages = data.recentThreads.filter((thread) =>
                  Boolean(thread.lastMessageAt)
                );
                if (threadsWithMessages.length === 0) {
                  return (
                    <EmptyState
                      title={t('communicationsEmpty')}
                      hint={t('communicationsEmptyHint')}
                    />
                  );
                }
                return (
                  <Stack>
                    {threadsWithMessages.map((thread) => (
                      <FeedItem
                        key={thread.id}
                        title={thread.title}
                        time={formatCompactStamp(thread.lastMessageAt!)}
                        unread={false}
                        preview={thread.preview ?? undefined}
                        onRead={() => {
                          router.push('/communications');
                        }}
                      />
                    ))}
                  </Stack>
                );
              })()}
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
  const me = useSession();
  const query = useQuery({
    queryKey: ['dashboard', 'mentor'],
    queryFn: api.mentorDashboard,
  });

  return (
    <Section>
      <Hero name={name} />
      <QuickAccess showCamps={me.capabilities.viewCamps} />
      {me.activeRole?.kind==='mentor'&&<AssistantSessionCreator/>}
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {query.data && <MentorDashboardBody data={query.data} />}
      </QueryState>
    </Section>
  );
}
