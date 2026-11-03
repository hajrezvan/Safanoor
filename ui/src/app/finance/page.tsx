'use client';

import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatDate,
  calendarDate,
  formatNumber,
  costItemSchema,
  programEventSchema,
} from '@safanoor/shared';

import { useWrite } from 'src/features/shared';
import { useFa } from 'src/locales/fa-provider';
import { api, client, unwrap } from 'src/api/client';
import { Session, useSession } from 'src/features/session';

import {
  Row,
  Card,
  Chip,
  Form,
  Text,
  Input,
  Stack,
  Button,
  Dialog,
  Notice,
  Select,
  Spread,
  EmptyState,
  PageHeader,
  QueryState,
  JalaliInput,
} from 'src/components/ui';

type ProgramEventSummary = components['schemas']['ProgramEventSummaryDto'];
type CampSummary = components['schemas']['CampSummaryDto'];

function useFinanceGroup() {
  const me = useSession();
  const groups = useQuery({
    queryKey: ['groups', 'finance'],
    queryFn: () => api.groups(),
  });
  const resolved = useMemo(() => {
    const managed = groups.data?.items.find((group) => group.canManage);
    if (managed) return { groupId: managed.id, canManage: true };
    if (me.person.groupId) return { groupId: me.person.groupId, canManage: false };
    return { groupId: null as string | null, canManage: false };
  }, [groups.data, me.person.groupId]);
  return {
    ...resolved,
    loading: groups.isLoading,
    error: groups.error,
    refetch: groups.refetch,
  };
}

function CreateDestinationDialog({
  open,
  onClose,
  onSubmit,
  busy,
  camps,
  campsLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof programEventSchema>) => void;
  busy: boolean;
  camps: CampSummary[];
  campsLoading: boolean;
}) {
  const t = useFa();
  const form = useForm({
    resolver: zodResolver(programEventSchema),
    defaultValues: {
      kind: 'custom' as const,
      title: undefined,
      campId: undefined,
      heldAt: undefined,
      place: undefined,
      notes: undefined,
      totalAmount: 0,
      memberPaymentAmount: 0,
    },
  });
  const kind = form.watch('kind');

  return (
    <Dialog
      open={open}
      title={t('createFinanceDestination')}
      onClose={onClose}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={busy} onClick={form.handleSubmit((values) => onSubmit(values))}>
            {t(busy ? 'busy' : 'create')}
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit((values) => onSubmit(values))}>
        <Controller
          name="kind"
          control={form.control}
          render={({ field }) => (
            <Select
              label={t('financeDestinationType')}
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                form.setValue('campId', undefined);
                form.setValue('title', undefined);
              }}
              options={[
                { value: 'camp', label: t('financeKindCamp') },
                { value: 'custom', label: t('financeKindProgram') },
              ]}
            />
          )}
        />
        {kind === 'camp' && (
          <>
            {campsLoading ? (
              <Text muted>{t('loading')}</Text>
            ) : camps.length === 0 ? (
              <Notice tone="warning">{t('financeNoCampsHint')}</Notice>
            ) : (
              <Controller
                name="campId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Select
                    label={t('selectCamp')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    options={camps.map((camp) => ({
                      value: camp.id,
                      label: `${camp.title}${camp.startsOn ? ` · ${formatDate(camp.startsOn)}` : ''}`,
                    }))}
                  />
                )}
              />
            )}
          </>
        )}
        {kind === 'custom' && (
          <>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  value={field.value ?? ''}
                  label={t('programTitle')}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="heldAt"
              control={form.control}
              render={({ field, fieldState }) => (
                <JalaliInput
                  label={t('programDate')}
                  value={field.value ? new Date(`${field.value}T12:00:00`) : null}
                  onChange={(date) =>
                    field.onChange(
                      date && !Number.isNaN(date.valueOf()) ? calendarDate(date) : undefined
                    )
                  }
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="place"
              control={form.control}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  value={field.value ?? ''}
                  label={t('programPlace')}
                  error={fieldState.error?.message}
                />
              )}
            />
          </>
        )}
        <Controller
          name="totalAmount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              label={t('financeTotalAmount')}
              value={field.value === 0 ? '' : String(field.value)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d]/g, '');
                field.onChange(raw === '' ? 0 : Number(raw));
              }}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="memberPaymentAmount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              label={t('financeMemberPaymentAmount')}
              value={field.value === 0 ? '' : String(field.value)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d]/g, '');
                field.onChange(raw === '' ? 0 : Number(raw));
              }}
              error={fieldState.error?.message}
            />
          )}
        />
        {kind === 'custom' && (
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                value={field.value ?? ''}
                label={t('programNotes')}
                multiline
                error={fieldState.error?.message}
              />
            )}
          />
        )}
      </Form>
    </Dialog>
  );
}

function AddCostDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof costItemSchema>) => void;
  busy: boolean;
}) {
  const t = useFa();
  const form = useForm({
    resolver: zodResolver(costItemSchema),
    defaultValues: { title: '', amount: 0, perPerson: false },
  });
  return (
    <Dialog
      open={open}
      title={t('addCostItem')}
      onClose={onClose}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={busy} onClick={form.handleSubmit((values) => onSubmit(values))}>
            {t(busy ? 'busy' : 'create')}
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit((values) => onSubmit(values))}>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input {...field} label={t('costItemTitle')} error={fieldState.error?.message} />
          )}
        />
        <Controller
          name="amount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              label={t('costAmount')}
              value={field.value === 0 ? '' : String(field.value)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d]/g, '');
                field.onChange(raw === '' ? 0 : Number(raw));
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      </Form>
    </Dialog>
  );
}

function DestinationDetail({
  destinationId,
  onBack,
}: {
  destinationId: string;
  onBack: () => void;
}) {
  const t = useFa();
  const cache = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const detail = useQuery({
    queryKey: ['finance-destination', destinationId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/finance/destinations/{id}', {
          params: { path: { id: destinationId } },
        })
      ),
  });
  const destination = detail.data;
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ['finance-destination', destinationId] });
    void cache.invalidateQueries({ queryKey: ['finance-destinations'] });
  };
  const addItem = useWrite(
    async (body: z.infer<typeof costItemSchema>) =>
      unwrap(
        await client.POST('/api/v1/finance/destinations/{id}/cost-items', {
          params: { path: { id: destinationId } },
          body: {
            title: body.title,
            amount: body.amount,
            perPerson: body.perPerson ?? false,
          },
        })
      ),
    () => {
      setAddOpen(false);
      invalidate();
    }
  );
  const removeItem = useWrite(
    async (itemId: string) =>
      unwrap(
        await client.DELETE('/api/v1/finance/destinations/{id}/cost-items/{itemId}', {
          params: { path: { id: destinationId, itemId } },
        })
      ),
    invalidate
  );

  return (
    <Stack>
      <PageHeader
        title={destination?.title ?? t('finance')}
        hint={
          destination
            ? [
                destination.kind === 'camp' ? t('financeKindCamp') : t('financeKindProgram'),
                destination.heldAt ? formatDate(destination.heldAt) : null,
                destination.place,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        action={
          <Button variant="outlined" onClick={onBack} icon="back">
            {t('backToFinance')}
          </Button>
        }
      />
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={() => void detail.refetch()}
      >
        {destination && (
          <>
            <Notice tone="info">{t('financeParentNote')}</Notice>
            <Card>
              <Stack>
                <Spread>
                  <Text variant="subtitle">{t('totalCost')}</Text>
                  <Chip>
                    {t('tomanAmount', { amount: formatNumber(destination.totalAmount) })}
                  </Chip>
                </Spread>
                <Spread>
                  <Text variant="subtitle">{t('memberPaymentCost')}</Text>
                  <Chip>
                    {t('tomanAmount', {
                      amount: formatNumber(destination.memberPaymentAmount),
                    })}
                  </Chip>
                </Spread>
              </Stack>
            </Card>
            {destination.canManage && (
              <Row>
                <Button icon="add" onClick={() => setAddOpen(true)}>
                  {t('addCostItem')}
                </Button>
              </Row>
            )}
            {destination.items.length === 0 ? (
              <EmptyState
                title={t('costItemsEmpty')}
                hint={t('costItemsEmptyHint')}
                action={
                  destination.canManage ? (
                    <Button icon="add" onClick={() => setAddOpen(true)}>
                      {t('addCostItem')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              destination.items.map((item) => (
                <Card key={item.id}>
                  <Stack>
                    <Spread>
                      <Stack>
                        <Text variant="subtitle">{item.title}</Text>
                        {item.perPerson && <Text muted>{t('costPerPerson')}</Text>}
                      </Stack>
                      <Chip>{t('tomanAmount', { amount: formatNumber(item.amount) })}</Chip>
                    </Spread>
                    {destination.canManage && (
                      <Row>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          disabled={removeItem.isPending}
                          onClick={() => removeItem.mutate(item.id)}
                        >
                          {t('deleteCostItem')}
                        </Button>
                      </Row>
                    )}
                  </Stack>
                </Card>
              ))
            )}
            {addItem.feedback}
            {removeItem.feedback}
          </>
        )}
      </QueryState>
      <AddCostDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        busy={addItem.isPending}
        onSubmit={(values) => addItem.mutate(values)}
      />
    </Stack>
  );
}

function DestinationList({
  groupId,
  canManage,
  onOpen,
}: {
  groupId: string;
  canManage: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useFa();
  const [createOpen, setCreateOpen] = useState(false);
  const list = useQuery({
    queryKey: ['finance-destinations', groupId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/finance/destinations', {
          params: { path: { id: groupId }, query: { page: 1, limit: 50 } },
        })
      ),
  });
  const camps = useQuery({
    queryKey: ['camps', groupId, 'finance'],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/camps', {
          params: { query: { page: 1, limit: 100, groupId } },
        })
      ),
    enabled: createOpen,
  });
  const create = useWrite(async (body: z.infer<typeof programEventSchema>) => {
    const created = unwrap(
      await client.POST('/api/v1/groups/{id}/finance/destinations', {
        params: { path: { id: groupId } },
        body: {
          kind: body.kind,
          title: body.title,
          campId: body.campId,
          heldAt: body.heldAt,
          place: body.place,
          notes: body.notes,
          totalAmount: body.totalAmount,
          memberPaymentAmount: body.memberPaymentAmount,
        },
      })
    );
    setCreateOpen(false);
    void list.refetch();
    onOpen(created.id);
    return created;
  });

  return (
    <Stack>
      <PageHeader
        title={t('finance')}
        action={
          canManage ? (
            <Button icon="add" onClick={() => setCreateOpen(true)}>
              {t('createFinanceDestination')}
            </Button>
          ) : undefined
        }
      />
      <QueryState loading={list.isLoading} error={list.error} retry={() => void list.refetch()}>
        {list.data && list.data.items.length === 0 ? (
          <EmptyState
            title={t('financeEmpty')}
            hint={t('financeEmptyHint')}
            action={
              canManage ? (
                <Button icon="add" onClick={() => setCreateOpen(true)}>
                  {t('createFinanceDestination')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          list.data?.items.map((destination: ProgramEventSummary) => (
            <Card key={destination.id}>
              <Stack>
                <Spread>
                  <Stack>
                    <Text variant="subtitle">{destination.title}</Text>
                    <Text muted>
                      {[
                        destination.kind === 'camp'
                          ? t('financeKindCamp')
                          : t('financeKindProgram'),
                        destination.heldAt ? formatDate(destination.heldAt) : null,
                        destination.place,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Stack>
                  <Stack>
                    <Chip>
                      {t('tomanAmount', { amount: formatNumber(destination.totalAmount) })}
                    </Chip>
                    <Text muted variant="caption">
                      {t('memberPaymentCost')}:{' '}
                      {t('tomanAmount', {
                        amount: formatNumber(destination.memberPaymentAmount),
                      })}
                    </Text>
                    <Text muted variant="caption">
                      {t('itemCount', { count: formatNumber(destination.itemCount) })}
                    </Text>
                  </Stack>
                </Spread>
                <Button variant="outlined" onClick={() => onOpen(destination.id)}>
                  {t('openFinanceDestination')}
                </Button>
              </Stack>
            </Card>
          ))
        )}
      </QueryState>
      {create.feedback}
      <CreateDestinationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        busy={create.isPending}
        camps={camps.data?.items ?? []}
        campsLoading={camps.isLoading}
        onSubmit={(values) => create.mutate(values)}
      />
    </Stack>
  );
}

function MemberFinance({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useFa();
  const status = useQuery({
    queryKey: ['member-finance'],
    queryFn: async () => unwrap(await client.GET('/api/v1/finance/me')),
  });
  const data = status.data;
  if (data?.canViewGroupFinance && data.groupId) {
    return <DestinationList groupId={data.groupId} canManage={false} onOpen={onOpen} />;
  }
  return (
    <Stack>
      <PageHeader title={t('finance')} />
      <QueryState loading={status.isLoading} error={status.error} retry={() => void status.refetch()}>
        {data && (
          <EmptyState
            title={t(data.status === 'no_costs' ? 'financeNoDebt' : data.status === 'no_group' ? 'noGroupForFinance' : 'financeCostsDefined')}
            hint={data.status === 'no_group' ? undefined : t(data.status === 'no_costs' ? 'financeNoDebtHint' : 'financeCostsDefinedHint')}
          />
        )}
      </QueryState>
    </Stack>
  );
}

function FinanceScreen() {
  const t = useFa();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupId, canManage, loading, error, refetch } = useFinanceGroup();
  return (
    <QueryState loading={loading} error={error} retry={() => void refetch()}>
      {!groupId ? (
        <Stack>
          <PageHeader title={t('finance')} />
          <EmptyState title={t('noGroupForFinance')} />
        </Stack>
      ) : selected ? (
        <DestinationDetail destinationId={selected} onBack={() => setSelected(null)} />
      ) : !canManage ? (
        <MemberFinance onOpen={setSelected} />
      ) : (
        <DestinationList groupId={groupId} canManage={canManage} onOpen={setSelected} />
      )}
    </QueryState>
  );
}

export default function Page() {
  return (
    <Session>
      <FinanceScreen />
    </Session>
  );
}
