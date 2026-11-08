'use client';

import type { TextKey } from 'src/locales/fa';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consentItems, formatNumber, requiredConsentItems } from '@safanoor/shared';

import { codeText } from 'src/locales/fa';
import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Card,
  Row,
  Text,
  Input,
  Stack,
  Button,
  Dialog,
  Notice,
  FormGrid,
  DataTable,
  PageHeader,
  QueryState,
} from 'src/components/ui';

import { useSession } from './session';
import { useWrite, BasicForm, Permission } from './shared';

type StorageForm = {
  endpoint: string;
  publicEndpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

export function SettingsScreen() {
  const me = useSession();
  const t = useFa();
  const [editing, setEditing] = useState<{ dataType: string; keepDays: number; action: string }>();
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [storageForm, setStorageForm] = useState<StorageForm>({
    endpoint: '',
    publicEndpoint: '',
    bucket: 'safanoor',
    region: 'us-east-1',
    accessKey: '',
    secretKey: '',
  });
  const retention = useQuery({
    queryKey: ['retention'],
    enabled: me.capabilities.manageSettings,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/admin/retention', { params: { query: { page: 1, limit: 100 } } })
      ),
  });
  const storage = useQuery({
    queryKey: ['admin-storage'],
    enabled: me.capabilities.manageSettings,
    queryFn: async () => unwrap(await client.GET('/api/v1/admin/storage')),
  });
  const applyStorageForm = (data: NonNullable<typeof storage.data>) => {
    if (data.mode === 'remote') {
      setStorageForm({
        endpoint: data.endpoint,
        publicEndpoint: data.publicEndpoint,
        bucket: data.bucket,
        region: data.region || 'us-east-1',
        accessKey: data.accessKey,
        secretKey: '',
      });
    }
  };
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
  const saveRemoteStorage = useWrite(
    async () =>
      unwrap(
        await client.PATCH('/api/v1/admin/storage', {
          body: {
            mode: 'remote',
            endpoint: storageForm.endpoint,
            publicEndpoint: storageForm.publicEndpoint || storageForm.endpoint,
            bucket: storageForm.bucket,
            region: storageForm.region,
            accessKey: storageForm.accessKey,
            secretKey: storageForm.secretKey,
          },
        })
      ),
    () => void storage.refetch().then((result) => result.data && applyStorageForm(result.data))
  );
  const useLocalStorage = useWrite(
    async () =>
      unwrap(
        await client.PATCH('/api/v1/admin/storage', {
          body: { mode: 'local' },
        })
      ),
    () => void storage.refetch()
  );
  useEffect(() => {
    if (storage.data?.mode === 'remote') applyStorageForm(storage.data);
  }, [storage.data]);
  return (
    <Permission allowed={me.capabilities.manageSettings}>
      <PageHeader title={t('settings')} />
      <Card>
        <Stack sx={{ gap: 1.5 }}>
          <PageHeader title={t('storageSettings')} hint={t('storageSettingsHint')} />
          <QueryState
            loading={storage.isLoading}
            error={storage.error}
            retry={() => void storage.refetch()}
          >
            {storage.data && (
              <Stack sx={{ gap: 1.5 }}>
                <Notice tone={storage.data.healthy ? 'success' : 'warning'}>
                  <Text variant="caption">
                    {storage.data.mode === 'local'
                      ? t('storageModeLocal')
                      : t('storageModeRemote')}
                    {' · '}
                    {storage.data.healthy ? t('storageHealthy') : t('storageUnhealthy')}
                    {storage.data.healthError ? ` — ${storage.data.healthError}` : ''}
                  </Text>
                </Notice>
                <Text muted variant="caption">
                  {t('storageDriver')}: {codeText(storage.data.driver)} ·{' '}
                  {storage.data.endpoint || '—'} · {storage.data.bucket || '—'}
                </Text>
                <FormGrid sx={{ gap: 1.5 }}>
                  <Input
                    label={t('storageEndpoint')}
                    value={storageForm.endpoint}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, endpoint: event.target.value })
                    }
                  />
                  <Input
                    label={t('storagePublicEndpoint')}
                    value={storageForm.publicEndpoint}
                    onChange={(event) =>
                      setStorageForm({
                        ...storageForm,
                        publicEndpoint: event.target.value,
                      })
                    }
                  />
                  <Input
                    label={t('storageBucket')}
                    value={storageForm.bucket}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, bucket: event.target.value })
                    }
                  />
                  <Input
                    label={t('storageRegion')}
                    value={storageForm.region}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, region: event.target.value })
                    }
                  />
                  <Input
                    label={t('storageAccessKey')}
                    value={storageForm.accessKey}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, accessKey: event.target.value })
                    }
                  />
                  <Input
                    label={t('storageSecretKey')}
                    type="password"
                    value={storageForm.secretKey}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, secretKey: event.target.value })
                    }
                  />
                </FormGrid>
                {saveRemoteStorage.feedback}
                {useLocalStorage.feedback}
                <Row>
                  <Button
                    disabled={
                      saveRemoteStorage.isPending ||
                      storageForm.endpoint.length < 8 ||
                      storageForm.bucket.length < 2 ||
                      storageForm.accessKey.length < 3 ||
                      storageForm.secretKey.length < 8
                    }
                    onClick={() => saveRemoteStorage.mutate(undefined)}
                  >
                    {t('storageSaveRemote')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={useLocalStorage.isPending || storage.data.mode === 'local'}
                    onClick={() => useLocalStorage.mutate(undefined)}
                  >
                    {t('storageUseLocal')}
                  </Button>
                </Row>
              </Stack>
            )}
          </QueryState>
        </Stack>
      </Card>
      <Card>
        <PageHeader
          title={t('consent')}
          hint={t('publishHint')}
          action={<Button onClick={() => setPublishing(true)}>{t('publishConsent')}</Button>}
        />
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
