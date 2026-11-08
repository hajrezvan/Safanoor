'use client';

import type { components } from 'src/api/generated/schema';
import type { TextKey } from 'src/locales/fa';

import { useQuery } from '@tanstack/react-query';
import { formatCompactStamp, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import { codeText } from 'src/locales/fa';

import {
  Card,
  Chip,
  Row,
  Text,
  Stack,
  Button,
  Notice,
  Section,
  StatCard,
  StatsGrid,
  EmptyState,
  QueryState,
  PageHeader,
  Spread,
} from 'src/components/ui';

type OpsDashboard = components['schemas']['OpsDashboardDto'];

function formatBytes(bytes: number, t: ReturnType<typeof useFa>): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024)
    return t('opsFileSizeKb', { value: formatNumber(Math.round(bytes / 1024)) });
  return t('opsFileSizeMb', {
    value: formatNumber(Math.round(bytes / (1024 * 1024))),
  });
}

function campStatusLabel(status: string, t: ReturnType<typeof useFa>) {
  const key = `campStatus_${status}` as TextKey;
  const label = t(key);
  return label === key ? codeText(status) : label;
}

function OpsBody({ data }: { data: OpsDashboard }) {
  const t = useFa();
  const healthy = data.health.database === 'ok' && data.health.storageHealthy;
  return (
    <Section>
      <PageHeader title={t('opsDashboardTitle')} hint={t('opsDashboardHint')} />
      <Notice tone={healthy ? 'success' : 'warning'}>
        <Text variant="caption">
          {t('opsHealthApi')}: {t('opsOk')}
          {' · '}
          {t('opsHealthDb')}:{' '}
          {data.health.database === 'ok' ? t('opsOk') : t('opsError')}
          {' · '}
          {t('opsHealthStorage')}:{' '}
          {data.health.storageMode === 'local'
            ? t('storageModeLocal')
            : t('storageModeRemote')}
          {' · '}
          {data.health.storageHealthy ? t('storageHealthy') : t('storageUnhealthy')}
          {data.health.storageError ? ` — ${data.health.storageError}` : ''}
        </Text>
      </Notice>
      <Text muted variant="caption">
        {t('storageDriver')}: {codeText(data.health.storageDriver)} ·{' '}
        {data.health.storageEndpoint || '—'} · {data.health.storageBucket || '—'}
      </Text>
      <StatsGrid>
        <StatCard
          title={t('opsPeople')}
          value={data.peopleCount}
          icon="people"
          href="/admin/groups"
        />
        <StatCard
          title={t('opsGroups')}
          value={data.groupCount}
          icon="groups"
          href="/admin/groups"
        />
        <StatCard
          title={t('opsUnread')}
          value={data.unreadNotifications}
          icon="notifications"
          href="/notifications"
        />
        <StatCard
          title={t('opsAuditDay')}
          value={data.auditLast24h}
          icon="audit"
          href="/admin/audit"
        />
        <StatCard
          title={t('opsOpenImports')}
          value={data.openImports}
          icon="imports"
          href="/admin/imports"
        />
      </StatsGrid>
      <Row>
        <Chip>
          {t('opsLmsItems')}: {formatNumber(data.lmsItemCount)}
        </Chip>
        <Chip>
          {t('opsFiles')}: {formatNumber(data.fileCount)} · {formatBytes(data.fileBytes, t)}
        </Chip>
        {data.campsByStatus.map((row) => (
          <Chip key={row.status}>
            {campStatusLabel(row.status, t)}: {formatNumber(row.count)}
          </Chip>
        ))}
      </Row>
      <Card>
        <Stack>
          <Text variant="subtitle">{t('opsShortcuts')}</Text>
          <Row>
            <Button href="/admin/settings" variant="outlined">
              {t('settings')}
            </Button>
            <Button href="/admin/audit" variant="outlined">
              {t('audit')}
            </Button>
            <Button href="/admin/groups" variant="outlined">
              {t('groups')}
            </Button>
            <Button href="/admin/imports" variant="outlined">
              {t('imports')}
            </Button>
          </Row>
        </Stack>
      </Card>
      {data.jobQueues.length > 0 && (
        <Card>
          <Stack>
            <Text variant="subtitle">{t('opsJobQueues')}</Text>
            <Row>
              {data.jobQueues.map((q) => (
                <Chip key={`${q.name}-${q.state}`}>
                  {codeText(q.name)} · {codeText(q.state)}: {formatNumber(q.count)}
                </Chip>
              ))}
            </Row>
          </Stack>
        </Card>
      )}
      <Card>
        <Stack>
          <Text variant="subtitle">{t('opsRecentEvents')}</Text>
          {data.recentEvents.length === 0 ? (
            <EmptyState title={t('opsRecentEventsEmpty')} />
          ) : (
            data.recentEvents.map((event) => (
              <Spread key={event.id}>
                <Stack sx={{ gap: 0.25, minWidth: 0 }}>
                  <Text variant="subtitle">{codeText(event.action)}</Text>
                  <Text muted variant="caption">
                    {[codeText(event.resourceType), event.actorName]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Stack>
                <Text muted variant="caption">
                  {formatCompactStamp(event.at)}
                </Text>
              </Spread>
            ))
          )}
        </Stack>
      </Card>
    </Section>
  );
}

export function OpsHomeDashboard() {
  const t = useFa();
  const query = useQuery({
    queryKey: ['ops-dashboard'],
    queryFn: async () => unwrap(await client.GET('/api/v1/admin/ops-dashboard')),
  });
  return (
    <QueryState
      loading={query.isLoading}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data ? (
        <OpsBody data={query.data} />
      ) : (
        <EmptyState title={t('opsDashboardEmpty')} />
      )}
    </QueryState>
  );
}
