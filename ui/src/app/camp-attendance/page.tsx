'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, type UseFormReturn } from 'react-hook-form';
import {
  campSchema,
  formatDate,
  calendarDate,
  formatNumber,
  formatCompactDate,
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
  Check,
  Input,
  Stack,
  Button,
  Dialog,
  Notice,
  Spread,
  FileInput,
  EmptyState,
  PageHeader,
  QueryState,
  JalaliInput,
  PersonCardMeta,
  CompactClickableCard,
} from 'src/components/ui';

type CampSummary = components['schemas']['CampSummaryDto'];
type CampDetail = components['schemas']['CampDetailDto'];
/** Form state before zod transforms/defaults (empty cost string, optional participantIds). */
type CampFormInput = z.input<typeof campSchema>;
/** Parsed camp payload after zodResolver runs. */
type CampFormValues = z.output<typeof campSchema>;
type CampForm = UseFormReturn<CampFormInput, unknown, CampFormValues>;

function useCampGroup() {
  const me = useSession();
  const groups = useQuery({
    queryKey: ['groups', 'camps'],
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

function statusLabel(t: ReturnType<typeof useFa>, status: string): string {
  const key = `campStatus_${status}` as TextKey;
  return t(key);
}

function CampFormFields({
  form,
  members,
}: {
  form: CampForm;
  members: { id: string; name: string }[];
}) {
  const t = useFa();
  const selected = form.watch('participantIds') ?? [];
  return (
    <Form onSubmit={(event) => event.preventDefault()}>
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input {...field} label={t('campTitleField')} error={fieldState.error?.message} />
        )}
      />
      <Row>
        <Controller
          name="startsOn"
          control={form.control}
          render={({ field, fieldState }) => (
            <JalaliInput
              label={t('campStartsOn')}
              value={field.value ? new Date(`${field.value}T12:00:00`) : null}
              onChange={(date) =>
                field.onChange(date && !Number.isNaN(date.valueOf()) ? calendarDate(date) : '')
              }
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="endsOn"
          control={form.control}
          render={({ field, fieldState }) => (
            <JalaliInput
              label={t('campEndsOn')}
              value={field.value ? new Date(`${field.value}T12:00:00`) : null}
              onChange={(date) =>
                field.onChange(date && !Number.isNaN(date.valueOf()) ? calendarDate(date) : '')
              }
              error={fieldState.error?.message}
            />
          )}
        />
      </Row>
      <Controller
        name="place"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            label={t('campPlace')}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="purpose"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            label={t('campPurpose')}
            multiline
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="costAmount"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            label={t('campCost')}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="durationText"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            label={t('campDuration')}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="scheduleText"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            label={t('campSchedule')}
            multiline
            error={fieldState.error?.message}
          />
        )}
      />
      <Stack>
        <Text variant="caption">{t('campParticipants')}</Text>
        {members.length === 0 ? (
          <Text muted>{t('empty')}</Text>
        ) : (
          members.map((member) => (
            <Check
              key={member.id}
              label={member.name}
              checked={selected.includes(member.id)}
              onChange={(checked) => {
                const next = checked
                  ? [...selected, member.id]
                  : selected.filter((id) => id !== member.id);
                form.setValue('participantIds', next, { shouldDirty: true });
              }}
            />
          ))
        )}
      </Stack>
    </Form>
  );
}

function CreateCampDialog({
  open,
  onClose,
  onSubmit,
  busy,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CampFormValues) => void;
  busy: boolean;
  members: { id: string; name: string }[];
}) {
  const t = useFa();
  const form = useForm<CampFormInput, unknown, CampFormValues>({
    resolver: zodResolver(campSchema),
    defaultValues: {
      title: '',
      startsOn: '',
      endsOn: '',
      place: undefined,
      purpose: undefined,
      costAmount: undefined,
      durationText: undefined,
      scheduleText: undefined,
      participantIds: [],
    },
  });
  useEffect(() => {
    if (open)
      form.reset({
        title: '',
        startsOn: '',
        endsOn: '',
        place: undefined,
        purpose: undefined,
        costAmount: undefined,
        durationText: undefined,
        scheduleText: undefined,
        participantIds: [],
      });
  }, [open, form]);
  return (
    <Dialog
      open={open}
      title={t('createCamp')}
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
      <CampFormFields form={form} members={members} />
    </Dialog>
  );
}

function CampDetailView({
  campId,
  canManage,
  members,
  onBack,
}: {
  campId: string;
  canManage: boolean;
  members: { id: string; name: string }[];
  onBack: () => void;
}) {
  const t = useFa();
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const detail = useQuery({
    queryKey: ['camp', campId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/camps/{id}', {
          params: { path: { id: campId } },
        })
      ),
  });
  const camp = detail.data as CampDetail | undefined;
  const form = useForm<CampFormInput, unknown, CampFormValues>({
    resolver: zodResolver(campSchema),
    defaultValues: {
      title: '',
      startsOn: '',
      endsOn: '',
      participantIds: [],
    },
  });
  useEffect(() => {
    if (!camp) return;
    form.reset({
      title: camp.title,
      startsOn: camp.startsOn,
      endsOn: camp.endsOn,
      place: camp.place ?? undefined,
      purpose: camp.purpose ?? undefined,
      costAmount:
        camp.costAmount === null || camp.costAmount === undefined
          ? undefined
          : String(camp.costAmount),
      durationText: camp.durationText ?? undefined,
      scheduleText: camp.scheduleText ?? undefined,
      participantIds: camp.participants.map((item) => item.personId),
    });
  }, [camp, form]);
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ['camp', campId] });
    void cache.invalidateQueries({ queryKey: ['camps'] });
  };
  const toPayload = (body: CampFormValues) => ({
    title: body.title,
    startsOn: body.startsOn,
    endsOn: body.endsOn,
    place: body.place ?? null,
    purpose: body.purpose ?? null,
    costAmount:
      body.costAmount === undefined || body.costAmount.trim() === ''
        ? null
        : Number(body.costAmount),
    durationText: body.durationText ?? null,
    scheduleText: body.scheduleText ?? null,
    participantIds: body.participantIds,
  });
  const update = useWrite(
    async (body: CampFormValues) =>
      unwrap(
        await client.PATCH('/api/v1/camps/{id}', {
          params: { path: { id: campId } },
          body: toPayload(body),
        })
      ),
    () => {
      setEditing(false);
      invalidate();
    }
  );
  const remove = useWrite(async (_: null) => {
    await unwrap(
      await client.DELETE('/api/v1/camps/{id}', {
        params: { path: { id: campId } },
      })
    );
  }, onBack);
  const uploadPermit = useWrite(
    async (file: File) => {
      const data = new FormData();
      data.append('file', file);
      return unwrap(
        await client.POST('/api/v1/camps/{id}/permit', {
          params: { path: { id: campId } },
          body: data as unknown as { file: string },
          bodySerializer: (body) => body as unknown as FormData,
        })
      );
    },
    () => {
      setPermitFile(null);
      invalidate();
    }
  );
  return (
    <Stack>
      <PageHeader
        title={camp?.title ?? t('campAttendance')}
        hint={camp ? `${formatDate(camp.startsOn)} — ${formatDate(camp.endsOn)}` : undefined}
        action={
          <Button variant="outlined" onClick={onBack} icon="back">
            {t('backToCamps')}
          </Button>
        }
      />
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={() => void detail.refetch()}
      >
        {camp && (
          <>
            {!canManage && <Notice tone="info">{t('campViewOnly')}</Notice>}
            <Row>
              <Chip>{statusLabel(t, camp.status)}</Chip>
              <Chip>{t('campParticipantCount', { count: camp.participantCount })}</Chip>
              {camp.hasPermit ? (
                <Chip tone="success">{t('campPermitUploaded')}</Chip>
              ) : (
                <Chip tone="warning">{t('campPermitMissing')}</Chip>
              )}
            </Row>
            {!editing && (
              <Card>
                <Stack>
                  {camp.place && (
                    <Text>
                      {t('campPlace')}: {camp.place}
                    </Text>
                  )}
                  {camp.purpose && (
                    <Text>
                      {t('campPurpose')}: {camp.purpose}
                    </Text>
                  )}
                  {camp.costAmount !== null && camp.costAmount !== undefined && (
                    <Text>
                      {t('campCost')}: {formatNumber(camp.costAmount)}
                    </Text>
                  )}
                  {camp.durationText && (
                    <Text>
                      {t('campDuration')}: {camp.durationText}
                    </Text>
                  )}
                  {camp.scheduleText && (
                    <Text>
                      {t('campSchedule')}: {camp.scheduleText}
                    </Text>
                  )}
                  <Text variant="subtitle">{t('campParticipants')}</Text>
                  {camp.participants.length === 0 ? (
                    <Text muted>{t('empty')}</Text>
                  ) : (
                    camp.participants.map((person) => (
                      <Text key={person.personId}>{person.name}</Text>
                    ))
                  )}
                </Stack>
              </Card>
            )}
            {editing && canManage && <CampFormFields form={form} members={members} />}
            {canManage && (
              <Row>
                {editing ? (
                  <>
                    <Button
                      disabled={update.isPending}
                      onClick={form.handleSubmit((values) => update.mutate(values))}
                    >
                      {t(update.isPending ? 'busy' : 'save')}
                    </Button>
                    <Button variant="outlined" onClick={() => setEditing(false)}>
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setEditing(true)}>{t('editCamp')}</Button>
                    <Button color="error" variant="outlined" onClick={() => setConfirmDelete(true)}>
                      {t('deleteCamp')}
                    </Button>
                  </>
                )}
              </Row>
            )}
            {canManage && (
              <Card>
                <Stack>
                  <Text variant="subtitle">{t('campPermit')}</Text>
                  <FileInput
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    label={t('campPermit')}
                    onChange={setPermitFile}
                  />
                  <Button
                    disabled={!permitFile || uploadPermit.isPending}
                    onClick={() => permitFile && uploadPermit.mutate(permitFile)}
                  >
                    {t(uploadPermit.isPending ? 'busy' : 'uploadCampPermit')}
                  </Button>
                  {uploadPermit.feedback}
                </Stack>
              </Card>
            )}
            {update.feedback}
            {remove.feedback}
          </>
        )}
      </QueryState>
      <Dialog
        open={confirmDelete}
        title={t('deleteCamp')}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmDelete(false)}>
              {t('cancel')}
            </Button>
            <Button color="error" disabled={remove.isPending} onClick={() => remove.mutate(null)}>
              {t(remove.isPending ? 'busy' : 'confirm')}
            </Button>
          </>
        }
      >
        <Text>{t('deleteCampHint')}</Text>
      </Dialog>
    </Stack>
  );
}

function CampList({
  groupId,
  canManage,
  members,
  onOpen,
}: {
  groupId: string;
  canManage: boolean;
  members: { id: string; name: string }[];
  onOpen: (id: string) => void;
}) {
  const t = useFa();
  const [createOpen, setCreateOpen] = useState(false);
  const list = useQuery({
    queryKey: ['camps', groupId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/camps', {
          params: { query: { page: 1, limit: 50, groupId } },
        })
      ),
  });
  const create = useWrite(
    async (body: CampFormValues) =>
      unwrap(
        await client.POST('/api/v1/camps', {
          body: {
            groupId,
            title: body.title,
            startsOn: body.startsOn,
            endsOn: body.endsOn,
            place: body.place,
            purpose: body.purpose,
            costAmount:
              body.costAmount === undefined || body.costAmount.trim() === ''
                ? undefined
                : Number(body.costAmount),
            durationText: body.durationText,
            scheduleText: body.scheduleText,
            participantIds: body.participantIds,
          },
        })
      ),
    () => {
      setCreateOpen(false);
      void list.refetch();
    }
  );
  return (
    <Stack>
      <PageHeader
        title={t('campAttendance')}
        action={
          canManage ? (
            <Button icon="add" onClick={() => setCreateOpen(true)}>
              {t('createCamp')}
            </Button>
          ) : undefined
        }
      />
      <QueryState loading={list.isLoading} error={list.error} retry={() => void list.refetch()}>
        {list.data && list.data.items.length === 0 ? (
          <Card>
            <EmptyState
              title={t('campsEmpty')}
              hint={null}
              action={
                canManage ? (
                  <Button icon="add" onClick={() => setCreateOpen(true)}>
                    {t('createCamp')}
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Stack>
            {list.data?.items.map((camp: CampSummary) => (
              <CompactClickableCard key={camp.id} type="button" onClick={() => onOpen(camp.id)}>
                <Spread>
                  <PersonCardMeta>
                    <Text variant="subtitle">{camp.title}</Text>
                    <Text muted variant="caption">
                      {[
                        `${formatCompactDate(camp.startsOn)} — ${formatCompactDate(camp.endsOn)}`,
                        camp.place,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </PersonCardMeta>
                  <Row>
                    <Chip>{statusLabel(t, camp.status)}</Chip>
                    <Chip>
                      {t('campParticipantCount', {
                        count: camp.participantCount,
                      })}
                    </Chip>
                  </Row>
                </Spread>
              </CompactClickableCard>
            ))}
          </Stack>
        )}
      </QueryState>
      {create.feedback}
      <CreateCampDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        busy={create.isPending}
        members={members}
        onSubmit={(values) => create.mutate(values)}
      />
    </Stack>
  );
}

function CampAttendanceScreen() {
  const t = useFa();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupId, canManage, loading, error, refetch } = useCampGroup();
  const members = useQuery({
    queryKey: ['group-members', groupId],
    enabled: !!groupId && canManage,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/members', {
          params: { path: { id: groupId! }, query: { page: 1, limit: 100 } },
        })
      ),
  });
  const memberOptions = useMemo(
    () =>
      (members.data?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
      })),
    [members.data]
  );
  return (
    <QueryState loading={loading} error={error} retry={() => void refetch()}>
      {!groupId ? (
        <Stack>
          <PageHeader title={t('campAttendance')} />
          <EmptyState title={t('noGroupForCamps')} />
        </Stack>
      ) : selected ? (
        <CampDetailView
          campId={selected}
          canManage={canManage}
          members={memberOptions}
          onBack={() => setSelected(null)}
        />
      ) : (
        <CampList
          groupId={groupId}
          canManage={canManage}
          members={memberOptions}
          onOpen={setSelected}
        />
      )}
    </QueryState>
  );
}

function CampAccess() {
  const me = useSession();
  const t = useFa();
  return me.capabilities.viewCamps ? (
    <CampAttendanceScreen />
  ) : (
    <EmptyState title={t('campAccessRestricted')} />
  );
}
export default function Page() {
  return (
    <Session>
      <CampAccess />
    </Session>
  );
}
