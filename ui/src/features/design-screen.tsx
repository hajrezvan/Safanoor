'use client';

import { useState } from 'react';
import { formatNumber } from '@safanoor/shared';

import { tokens } from 'src/theme/tokens';
import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Card,
  Chip,
  Grid,
  Tabs,
  Text,
  Check,
  Input,
  Stack,
  Toast,
  Avatar,
  Button,
  Dialog,
  Notice,
  Select,
  Section,
  Skeleton,
  StatCard,
  DataTable,
  EmptyState,
  PageHeader,
  BottomSheet,
  JalaliInput,
  ThemeSwitch,
  DesignLayout,
  PreviewTheme,
  TokenSwatches,
} from 'src/components/ui';

export function DesignScreen() {
  const t = useFa();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('a');
  return (
    <DesignLayout>
      <Section>
        <PageHeader title={t('design')} action={<ThemeSwitch />} />
        <Grid>
          {(['light', 'dark'] as const).map((mode) => (
            <PreviewTheme key={mode} mode={mode}>
              <Section>
                <Text variant="title">{t(mode)}</Text>
                <Card>
                  <Stack>
                    <Text variant="subtitle">{t('components')}</Text>
                    <Row>
                      <Avatar name={t('brand')} />
                      <Chip>{t('example')}</Chip>
                      <Chip tone="success">{t('done')}</Chip>
                    </Row>
                    <Input label={t('name')} value={t('example')} />
                    <Select
                      label={t('group')}
                      value="a"
                      options={[{ value: 'a', label: t('example') }]}
                      onChange={() => {}}
                    />
                    <JalaliInput label={t('birthDate')} value={null} onChange={() => {}} />
                    <Check label={t('consent')} checked onChange={() => {}} />
                    <Button onClick={() => setToast(t('done'))}>{t('toast')}</Button>
                    <Button variant="outlined" onClick={() => setDialog(true)}>
                      {t('dialog')}
                    </Button>
                    <Button variant="text" onClick={() => setSheet(true)}>
                      {t('bottomSheet')}
                    </Button>
                    <Tabs
                      value={tab}
                      onChange={setTab}
                      items={[
                        { value: 'a', label: t('home') },
                        { value: 'b', label: t('people') },
                      ]}
                    />
                    <Notice>{t('privacyHint')}</Notice>
                    <StatCard title={t('peopleCount')} value={12} />
                    <DataTable
                      rows={[{ id: '1', name: t('example') }]}
                      rowKey={(row) => row.id}
                      columns={[{ label: t('name'), render: (row) => row.name }]}
                    />
                    <EmptyState />
                    <Skeleton />
                  </Stack>
                </Card>
              </Section>
            </PreviewTheme>
          ))}
        </Grid>
        <Text variant="title">{t('tokens')}</Text>
        <Text>
          {Object.entries(tokens.radius)
            .map(([key, value]) => `${key}: ${formatNumber(value)}`)
            .join(' · ')}
        </Text>
        <TokenSwatches />
        {(['space', 'type', 'motion', 'shadow', 'layout'] as const).map((group) => (
          <Stack key={group}>
            <Text variant="subtitle">{t(`token.${group}`)}</Text>
            {Object.entries(tokens[group]).map(([key, value]) => (
              <Text key={key}>
                {key}: {typeof value === 'number' ? formatNumber(value) : value}
              </Text>
            ))}
          </Stack>
        ))}
        <Dialog open={dialog} title={t('dialog')} onClose={() => setDialog(false)}>
          <Text>{t('example')}</Text>
        </Dialog>
        <BottomSheet open={sheet} title={t('bottomSheet')} onClose={() => setSheet(false)}>
          <Text>{t('example')}</Text>
        </BottomSheet>
        <Toast message={toast} onClose={() => setToast('')} />
      </Section>
    </DesignLayout>
  );
}
