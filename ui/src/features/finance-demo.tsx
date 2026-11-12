'use client';

import type { components } from 'src/api/generated/schema';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatNumber } from '@safanoor/shared';

import { useFa } from 'src/locales/fa-provider';
import { client, unwrap } from 'src/api/client';

import {
  Grid,
  Text,
  Chip,
  Stack,
  Button,
  Dialog,
  Notice,
  Spread,
  PageHeader,
  QueryState,
  ProfilePanel,
} from 'src/components/ui';

type Item = components['schemas']['FinanceDemoItemDto'];
const presentation = {
  settled: { tone: 'mint', chip: 'success', label: 'financeDemoSettled' },
  partial: { tone: 'sky', chip: 'warning', label: 'financeDemoPartial' },
  unpaid: { tone: 'peach', chip: 'error', label: 'financeDemoUnpaid' },
} as const;

export function FinanceDemo() {
  const t = useFa();
  const [selected, setSelected] = useState<Item | null>(null);
  const query = useQuery({
    queryKey: ['finance-demo'],
    queryFn: async () => unwrap(await client.GET('/api/v1/finance/demo')),
  });
  const money = (amount: number) => t('tomanAmount', { amount: formatNumber(amount) });
  return (
    <Stack>
      <PageHeader title={t('financeDemoTitle')} />
      <Notice tone="warning">{t('financeDemoNotice')}</Notice>
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {query.data && (
          <>
            <Grid>
              <ProfilePanel tone="lavender">
                <Stack>
                  <Text muted>{t('financeDemoTotal')}</Text>
                  <Text variant="title">{money(query.data.total)}</Text>
                </Stack>
              </ProfilePanel>
              <ProfilePanel tone="mint">
                <Stack>
                  <Text muted>{t('financeDemoPaid')}</Text>
                  <Text variant="title">{money(query.data.paid)}</Text>
                </Stack>
              </ProfilePanel>
              <ProfilePanel tone="peach">
                <Stack>
                  <Text muted>{t('financeDemoRemaining')}</Text>
                  <Text variant="title">{money(query.data.remaining)}</Text>
                </Stack>
              </ProfilePanel>
            </Grid>
            <Grid>
              {query.data.items.map((item) => {
                const style = presentation[item.status];
                return (
                  <ProfilePanel key={item.id} tone={style.tone}>
                    <Stack>
                      <Chip tone={style.chip}>{t(style.label)}</Chip>
                      <Text variant="subtitle">{item.title}</Text>
                      <Text muted variant="caption">
                        {formatDate(item.date)}
                      </Text>
                      <Spread>
                        <Text>{t('financeDemoShare')}</Text>
                        <Text>{money(item.amount)}</Text>
                      </Spread>
                      <Spread>
                        <Text>{t('financeDemoPaidLabel')}</Text>
                        <Text>{money(item.paid)}</Text>
                      </Spread>
                      <Spread>
                        <Text>{t('financeDemoRemainingLabel')}</Text>
                        <Text variant="subtitle">{money(item.remaining)}</Text>
                      </Spread>
                      <Button variant="outlined" onClick={() => setSelected(item)}>
                        {t('financeDemoDetails')}
                      </Button>
                    </Stack>
                  </ProfilePanel>
                );
              })}
            </Grid>
          </>
        )}
      </QueryState>
      <Dialog
        open={!!selected}
        title={selected?.title ?? t('financeDemoDetails')}
        onClose={() => setSelected(null)}
      >
        <Notice tone="warning">{t('financeDemoNotice')}</Notice>
        <Text variant="subtitle">{t('financeDemoCosts')}</Text>
        {selected?.lines.map((line) => (
          <Spread key={line.title}>
            <Text>{line.title}</Text>
            <Text>{money(line.amount)}</Text>
          </Spread>
        ))}
        <Text variant="subtitle">{t('financeDemoPayments')}</Text>
        {selected?.payments.length ? (
          selected.payments.map((payment) => (
            <Spread key={payment.date}>
              <Text>{formatDate(payment.date)}</Text>
              <Text>{money(payment.amount)}</Text>
            </Spread>
          ))
        ) : (
          <Text muted>{t('financeDemoNoPayments')}</Text>
        )}
      </Dialog>
    </Stack>
  );
}
