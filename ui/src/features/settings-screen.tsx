'use client';

import type { TextKey } from 'src/locales/fa';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consentItems, formatNumber, requiredConsentItems } from '@safanoor/shared';

import { codeText } from 'src/locales/fa';
import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Card,
  Text,
  Input,
  Button,
  Dialog,
  Notice,
  Section,
  DataTable,
  PageHeader,
  QueryState,
} from 'src/components/ui';

import { useSession } from './session';
import { useWrite, BasicForm, Permission } from './shared';

export function SettingsScreen() {
  const me = useSession();
  const t = useFa();
  const [editing, setEditing] = useState<{ dataType: string; keepDays: number; action: string }>();
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const retention = useQuery({
    queryKey: ['retention'],
    enabled: me.capabilities.manageSettings,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/admin/retention', { params: { query: { page: 1, limit: 100 } } })
      ),
  });
  const jobs = useQuery({
    queryKey: ['jobs'],
    enabled: me.capabilities.manageSettings,
    queryFn: async () => unwrap(await client.GET('/api/v1/admin/jobs')),
    refetchInterval: 15000,
  });
  const save = useWrite(
    async (values: Record<string, string>) =>
      unwrap(
        await client.PATCH('/api/v1/admin/retention/{type}', {
          params: { path: { type: editing!.dataType } },
          body: {
            keepDays: Number(values.keepDays),
            action: editing!.action as 'delete' | 'archive' | 'anonymize',
          },
        })
      ),
    () => setEditing(undefined)
  );
  const publish = useWrite(
    async () =>
      unwrap(
        await client.POST('/api/v1/consent/versions', {
          body: {
            title,
            items: consentItems.map((key) => ({
              key,
              text: texts[key] ?? '',
              required: requiredConsentItems.includes(key),
            })),
          },
        })
      ),
    () => setPublishing(false)
  );
  const parent = useWrite(async (v: Record<string, string>) =>
    unwrap(
      await client.POST('/api/v1/admin/parents', {
        body: {
          firstName: v.firstName,
          lastName: v.lastName,
          phone: v.phone,
          password: v.password,
        },
      })
    )
  );
  return (
    <Permission allowed={me.capabilities.manageSettings}>
      <PageHeader title={t('settings')} />
      <Card>
        <Section>
          <PageHeader
            title={t('consent')}
            hint={t('publishHint')}
            action={<Button onClick={() => setPublishing(true)}>{t('publishConsent')}</Button>}
          />
        </Section>
      </Card>
      <PageHeader title={t('retention')} />
      <QueryState
        loading={retention.isLoading}
        error={retention.error}
        empty={retention.data?.items.length === 0}
        retry={() => void retention.refetch()}
      >
        <DataTable
          rows={retention.data?.items ?? []}
          rowKey={(row) => row.dataType}
          columns={[
            { label: t('dataType'), render: (row) => codeText(row.dataType) },
            { label: t('keepDays'), render: (row) => formatNumber(row.keepDays) },
            {
              label: t('actions'),
              render: (row) => (
                <Button variant="text" onClick={() => setEditing(row)}>
                  {t('edit')}
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      <PageHeader title={t('jobs')} />
      <QueryState
        loading={jobs.isLoading}
        error={jobs.error}
        empty={jobs.data?.queues.length === 0}
        retry={() => void jobs.refetch()}
      >
        <DataTable
          rows={jobs.data?.queues ?? []}
          rowKey={(row) => row.name + row.state}
          columns={[
            { label: t('queue'), render: (row) => codeText(row.name) },
            { label: t('status'), render: (row) => codeText(row.state) },
            { label: t('count'), render: (row) => formatNumber(row.count) },
          ]}
        />
      </QueryState>
      <Card>
        <Section>
          <Text variant="subtitle">{t('parentAccount')}</Text>
          <BasicForm
            fields={[
              { key: 'firstName', label: 'firstName' },
              { key: 'lastName', label: 'lastName' },
              { key: 'phone', label: 'phone', type: 'tel' },
              { key: 'password', label: 'newPassword', type: 'password' },
            ]}
            onSubmit={parent.mutate}
            busy={parent.isPending}
          />
          {parent.feedback}
        </Section>
      </Card>

      <Dialog open={!!editing} title={t('retention')} onClose={() => setEditing(undefined)}>
        {editing && (
          <BasicForm
            key={editing.dataType}
            initial={{ keepDays: String(editing.keepDays) }}
            fields={[{ key: 'keepDays', label: 'keepDays', type: 'number' }]}
            onSubmit={save.mutate}
            busy={save.isPending}
          />
        )}
        {save.feedback}
      </Dialog>
      <Dialog open={publishing} title={t('publishConsent')} onClose={() => setPublishing(false)}>
        <Notice tone="warning">{t('publishHint')}</Notice>
        <Input
          label={t('title')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {consentItems.map((key) => (
          <Input
            key={key}
            label={t((key === 'retention' ? 'retentionItem' : key) as TextKey)}
            value={texts[key] ?? ''}
            multiline
            onChange={(event) => setTexts({ ...texts, [key]: event.target.value })}
          />
        ))}
        {publish.feedback}
        <Button
          disabled={
            publish.isPending ||
            title.length < 3 ||
            consentItems.some((key) => (texts[key]?.length ?? 0) < 3)
          }
          onClick={() => publish.mutate(undefined)}
        >
          {t('publish')}
        </Button>
      </Dialog>
    </Permission>
  );
}
