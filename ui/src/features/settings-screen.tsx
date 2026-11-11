'use client';

import { useState, useEffect } from 'react';
import { formatNumber } from '@safanoor/shared';
import { useQuery } from '@tanstack/react-query';

import { codeText } from 'src/locales/fa';
import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Card,
  Text,
  Chip,
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

function toRemoteStorageForm(data: {
  endpoint: string;
  publicEndpoint: string;
  bucket: string;
  region?: string | null;
  accessKey: string;
}): StorageForm {
  return {
    endpoint: data.endpoint,
    publicEndpoint: data.publicEndpoint,
    bucket: data.bucket,
    region: data.region || 'us-east-1',
    accessKey: data.accessKey,
    secretKey: '',
  };
}

export function SettingsScreen() {
  const me = useSession();
  const t = useFa();
  const [editing, setEditing] = useState<{ dataType: string; keepDays: number; action: string }>();
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
    () =>
      void storage
        .refetch()
        .then(
          (result) =>
            result.data?.mode === 'remote' && setStorageForm(toRemoteStorageForm(result.data))
        )
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
    if (storage.data?.mode === 'remote') setStorageForm(toRemoteStorageForm(storage.data));
  }, [storage.data]);
  return (
    <Permission allowed={me.capabilities.manageSettings}>
      <PageHeader title={t('settings')} />
      <Card>
        <Stack sx={{ gap: 1.5 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Row sx={{ gap: 1 }}>
              <Text variant="subtitle">{t('storageSettings')}</Text>
              {storage.data && (
                <Chip tone={storage.data.healthy ? 'success' : 'warning'}>
                  {storage.data.mode === 'local' ? t('storageModeLocal') : t('storageModeRemote')}
                  {' · '}
                  {storage.data.healthy ? t('storageHealthy') : t('storageUnhealthy')}
                </Chip>
              )}
            </Row>
            <Text muted variant="caption">
              {t('storageSettingsHint')}
            </Text>
          </Stack>
          <QueryState
            loading={storage.isLoading}
            error={storage.error}
            retry={() => void storage.refetch()}
          >
            {storage.data && (
              <Stack sx={{ gap: 1.5 }}>
                {storage.data.healthError && (
                  <Notice tone="warning">
                    <Text variant="caption">{storage.data.healthError}</Text>
                  </Notice>
                )}
                <Text muted variant="caption">
                  {t('storageDriver')}: {codeText(storage.data.driver)} ·{' '}
                  {storage.data.endpoint || '—'} · {storage.data.bucket || '—'}
                </Text>
                <FormGrid sx={{ gap: 1.5 }}>
                  <Input
                    size="small"
                    label={t('storageEndpoint')}
                    value={storageForm.endpoint}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, endpoint: event.target.value })
                    }
                  />
                  <Input
                    size="small"
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
                    size="small"
                    label={t('storageBucket')}
                    value={storageForm.bucket}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, bucket: event.target.value })
                    }
                  />
                  <Input
                    size="small"
                    label={t('storageRegion')}
                    value={storageForm.region}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, region: event.target.value })
                    }
                  />
                  <Input
                    size="small"
                    label={t('storageAccessKey')}
                    value={storageForm.accessKey}
                    onChange={(event) =>
                      setStorageForm({ ...storageForm, accessKey: event.target.value })
                    }
                  />
                  <Input
                    size="small"
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
      <PageHeader title={t('retention')} />
      <QueryState
        loading={retention.isLoading}
        error={retention.error}
        empty={retention.data?.items.length === 0}
        retry={() => void retention.refetch()}
      >
        <DataTable
          density="compact"
          rows={retention.data?.items ?? []}
          rowKey={(row) => row.dataType}
          columns={[
            { label: t('dataType'), render: (row) => codeText(row.dataType) },
            { label: t('keepDays'), render: (row) => formatNumber(row.keepDays) },
            {
              label: t('actions'),
              render: (row) => (
                <Button size="small" variant="text" onClick={() => setEditing(row)}>
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
    </Permission>
  );
}
