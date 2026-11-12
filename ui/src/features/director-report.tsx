'use client';

import type { TextKey } from 'src/locales/fa';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Grid,
  Text,
  Stack,
  Input,
  Button,
  Notice,
  Spread,
  PageHeader,
  Pagination,
  QueryState,
  EmptyState,
  ProfilePanel,
} from 'src/components/ui';

const names: Record<string, TextKey> = Object.fromEntries(
  [
    'people',
    'groups',
    'mentor',
    'assistant',
    'consultations',
    'meetings',
    'library',
    'reportBooks',
    'reportCompletedBooks',
    'classes',
    'reportPublishedClasses',
    'groupAlbum',
    'campAttendance',
    'reportFinanceDestinations',
    'reportCosts',
  ].map((key) => [key, key])
) as Record<string, TextKey>;
const tones = ['mint', 'sky', 'lavender', 'peach', 'honey'] as const;
export function DirectorReport() {
  const t = useFa();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const summary = useQuery({
    queryKey: ['director-report'],
    queryFn: async () => unwrap(await client.GET('/api/v1/dashboard/organization')),
  });
  const people = useQuery({
    queryKey: ['director-people', page, search],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/dashboard/organization/people', {
          params: { query: { page, limit: 20, search } },
        })
      ),
  });
  return (
    <Stack>
      <PageHeader title={t('directorReport')} hint={t('directorReportHint')} />
      <Notice>{t('directorReportScope')}</Notice>
      <Button
        variant="outlined"
        onClick={() => {
          void summary.refetch();
          void people.refetch();
        }}
      >
        {t('reportRefresh')}
      </Button>
      <QueryState
        loading={summary.isLoading}
        error={summary.error}
        retry={() => void summary.refetch()}
      >
        {summary.data && (
          <>
            <Text muted>
              {t('reportUpdated')}: {formatDate(summary.data.generatedAt, true)}
            </Text>
            <Grid>
              {summary.data.metrics.map((metric, index) => (
                <ProfilePanel key={metric.key} tone={tones[index % tones.length]}>
                  <Stack>
                    <Text muted>{t(names[metric.key] ?? 'total')}</Text>
                    <Text variant="title">
                      {metric.key === 'reportCosts'
                        ? t('tomanAmount', { amount: formatNumber(metric.count) })
                        : formatNumber(metric.count)}
                    </Text>
                  </Stack>
                </ProfilePanel>
              ))}
            </Grid>
          </>
        )}
      </QueryState>
      <Text variant="title">{t('reportPeople')}</Text>
      <Input
        label={t('search')}
        value={search}
        onChange={(value) => {
          setSearch(value.target.value);
          setPage(1);
        }}
      />
      <QueryState
        loading={people.isLoading}
        error={people.error}
        retry={() => void people.refetch()}
      >
        {people.data && (
          <>
            {!people.data.items.length && <EmptyState title={t('empty')} />}
            <Grid>
              {people.data.items.map((person) => (
                <ProfilePanel key={person.id} tone="sky">
                  <Stack>
                    <Text variant="subtitle">{person.name}</Text>
                    <Spread>
                      <Text>{t(person.orgLevel as TextKey)}</Text>
                      <Text muted>{person.groupName}</Text>
                    </Spread>
                  </Stack>
                </ProfilePanel>
              ))}
            </Grid>
            <Pagination
              page={page}
              total={people.data.total}
              limit={people.data.limit}
              onChange={setPage}
            />
          </>
        )}
      </QueryState>
    </Stack>
  );
}
