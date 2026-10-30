'use client';

import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCompactDate, formatDate, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import {
  Button,
  CompactClickableCard,
  ConsultationCardsGrid,
  Dialog,
  Form,
  FormGrid,
  Input,
  JalaliInput,
  Notice,
  PageHeader,
  Pagination,
  PersonCardMeta,
  ProfileAvatar,
  QueryState,
  Row,
  Search,
  Select,
  SoftIcon,
  Spread,
  Stack,
  Text,
} from 'src/components/ui';

import { MultiPersonPicker } from './person-picker';
import { useSession } from './session';
import { useWrite } from './shared';

type ConsultationSummary = components['schemas']['ConsultationSummaryDto'];
type ConsultationDetail = components['schemas']['ConsultationDetailDto'];

const consultationFormSchema = z
  .object({
    heldDate: z.date({ required_error: 'required' }),
    heldTime: z.string().regex(/^\d{2}:\d{2}$/),
    kind: z.enum(['in_person', 'phone']),
    durationMinutes: z.coerce.number().int().min(1).max(480),
    place: z.string().max(200),
    memberIds: z.array(z.string().uuid()).min(1),
    sharedSummary: z.string().max(8000),
    privateNote: z.string().max(8000),
  })
  .superRefine((value, context) => {
    if (value.kind === 'in_person' && !value.place.trim())
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['place'],
        message: 'required',
      });
  });

type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

function combineHeldAt(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next.toISOString();
}

function KindIcon({
  kind,
  label,
  size = 22,
}: {
  kind: 'in_person' | 'phone';
  label: string;
  size?: number;
}) {
  return (
    <SoftIcon
      label={label}
      size={size}
      icon={kind === 'phone' ? 'solar:phone-bold' : 'solar:users-group-rounded-bold'}
    />
  );
}

function memberLabel(preview: string, count: number, t: ReturnType<typeof useFa>) {
  if (!preview) return t('consultationMemberCount', { count: formatNumber(count) });
  const names = preview.split('، ').filter(Boolean);
  if (names.length === 1) return names[0]!;
  if (names.length <= 2) return names.join('، ');
  return `${names.slice(0, 2).join('، ')} · ${t('consultationMemberCount', { count: formatNumber(count) })}`;
}

/** Time only as `۱۸:۰۰` — never includes the word «ساعت». */
function formatHeldTime(value: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

function ConsultationCard({
  item,
  onOpen,
}: {
  item: ConsultationSummary;
  onOpen: () => void;
}) {
  const t = useFa();
  const kindLabel = t(
    item.kind === 'in_person' ? 'consultationKindInPerson' : 'consultationKindPhone',
  );
  const name = memberLabel(item.memberPreview, item.memberCount, t);
  return (
    <CompactClickableCard type="button" onClick={onOpen}>
      <PersonCardMeta>
        <Spread>
          <Text muted variant="caption">
            {formatCompactDate(item.heldAt)} {formatHeldTime(item.heldAt)}
          </Text>
          <KindIcon kind={item.kind} label={kindLabel} size={16} />
        </Spread>
        <Text muted variant="caption">
          {t('consultationDurationValue', {
            minutes: formatNumber(item.durationMinutes),
          })}
        </Text>
        <Row>
          <ProfileAvatar name={name} size={24} />
          <Text variant="caption">{name}</Text>
        </Row>
      </PersonCardMeta>
    </CompactClickableCard>
  );
}

function ConsultationEditor({
  open,
  onClose,
  groupId,
  members,
  initial,
  initialPrivateNote,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: { id: string; name: string }[];
  initial?: ConsultationDetail;
  initialPrivateNote?: string;
}) {
  const t = useFa();
  const me = useSession();
  const cache = useQueryClient();
  const canWritePrivate =
    !initial || initial.authorId === me.person.id;
  const defaults = useMemo<ConsultationFormValues>(() => {
    if (!initial) {
      return {
        heldDate: new Date(),
        heldTime: '18:00',
        kind: 'in_person',
        durationMinutes: 30,
        place: '',
        memberIds: [],
        sharedSummary: '',
        privateNote: '',
      };
    }
    const held = new Date(initial.heldAt);
    return {
      heldDate: held,
      heldTime: `${String(held.getHours()).padStart(2, '0')}:${String(held.getMinutes()).padStart(2, '0')}`,
      kind: initial.kind,
      durationMinutes: initial.durationMinutes,
      place: initial.place ?? '',
      memberIds: initial.members.map((row) => row.id),
      sharedSummary: initial.sharedSummary,
      privateNote: initialPrivateNote ?? '',
    };
  }, [initial, initialPrivateNote]);
  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    values: defaults,
  });
  const kind = form.watch('kind');
  const memberOptions = members.map((row) => ({ value: row.id, label: row.name }));
  const save = useWrite(async (values: ConsultationFormValues) => {
    const body = {
      heldAt: combineHeldAt(values.heldDate, values.heldTime),
      kind: values.kind,
      durationMinutes: values.durationMinutes,
      place: values.kind === 'phone' ? values.place.trim() || null : values.place.trim(),
      memberIds: values.memberIds,
      sharedSummary: values.sharedSummary.trim() || undefined,
    };
    const saved = initial
      ? unwrap(
          await client.PATCH('/api/v1/consultations/{id}', {
            params: { path: { id: initial.id } },
            body,
          })
        )
      : unwrap(
          await client.POST('/api/v1/consultations', {
            body: { ...body, groupId },
          })
        );
    if (canWritePrivate) {
      await unwrap(
        await client.PUT('/api/v1/consultations/{id}/private-note', {
          params: { path: { id: saved.id } },
          body: { body: values.privateNote.trim() },
        })
      );
    }
    return saved;
  }, () => {
    void cache.invalidateQueries({ queryKey: ['consultations'] });
    if (initial) {
      void cache.invalidateQueries({ queryKey: ['consultation', initial.id] });
      void cache.invalidateQueries({ queryKey: ['consultation-private-note', initial.id] });
    }
    onClose();
  });
  return (
    <Dialog
      open={open}
      title={t(initial ? 'editConsultation' : 'createConsultation')}
      onClose={onClose}
      actions={
        <Row>
          <Button variant="text" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={save.isPending}
            onClick={form.handleSubmit((values) => save.mutate(values))}
          >
            {t(save.isPending ? 'busy' : 'saveConsultation')}
          </Button>
        </Row>
      }
    >
      <Form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormGrid>
          <Controller
            name="heldDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <JalaliInput
                label={t('consultationHeldAt')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error ? t('required') : undefined}
              />
            )}
          />
          <Controller
            name="heldTime"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label={t('consultationTime')}
                type="time"
                error={fieldState.error ? t('invalid') : undefined}
              />
            )}
          />
          <Controller
            name="kind"
            control={form.control}
            render={({ field }) => (
              <Select
                label={t('consultationKind')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'in_person', label: t('consultationKindInPerson') },
                  { value: 'phone', label: t('consultationKindPhone') },
                ]}
              />
            )}
          />
          <Controller
            name="durationMinutes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                value={String(field.value)}
                onChange={(event) => field.onChange(event.target.value)}
                label={t('consultationDuration')}
                type="number"
                error={fieldState.error ? t('invalid') : undefined}
              />
            )}
          />
          {kind === 'in_person' ? (
            <Controller
              name="place"
              control={form.control}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label={t('consultationPlace')}
                  error={fieldState.error ? t('required') : undefined}
                />
              )}
            />
          ) : null}
        </FormGrid>
        <Controller
          name="memberIds"
          control={form.control}
          render={({ field, fieldState }) => (
            <MultiPersonPicker
              label={t('consultationMembers')}
              searchLabel={t('consultationSearchMembers')}
              values={field.value}
              onChange={field.onChange}
              options={memberOptions}
              limit={5}
              error={fieldState.error ? t('required') : undefined}
              emptyHint={t('consultationNoMembers')}
            />
          )}
        />
        <Notice tone="warning" emphasis>
          {t('consultationSummaryReminder')}
        </Notice>
        <Controller
          name="sharedSummary"
          control={form.control}
          render={({ field }) => (
            <Input {...field} label={t('consultationSharedSummary')} multiline />
          )}
        />
        {canWritePrivate ? (
          <Stack>
            <Notice tone="info">{t('consultationPrivateNoteHint')}</Notice>
            <Controller
              name="privateNote"
              control={form.control}
              render={({ field }) => (
                <Input {...field} label={t('consultationPrivateNote')} multiline />
              )}
            />
          </Stack>
        ) : null}
        {save.feedback}
      </Form>
    </Dialog>
  );
}

function ConsultationDetailCard({
  item,
  privateNote,
  privateNoteVisible,
  onEdit,
  onClose,
}: {
  item: ConsultationDetail;
  privateNote?: string;
  privateNoteVisible: boolean;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const t = useFa();
  const kindLabel = t(
    item.kind === 'in_person' ? 'consultationKindInPerson' : 'consultationKindPhone',
  );
  return (
    <Dialog
      open
      title={t('consultationDetail')}
      onClose={onClose}
      actions={
        <Row>
          <Button variant="text" onClick={onClose}>
            {t('close')}
          </Button>
          {onEdit ? (
            <Button onClick={onEdit}>{t('editConsultation')}</Button>
          ) : null}
        </Row>
      }
    >
      <Stack>
        <Row>
          <KindIcon kind={item.kind} label={kindLabel} />
          <Text muted>{kindLabel}</Text>
          <Text muted>
            {t('consultationDurationValue', { minutes: formatNumber(item.durationMinutes) })}
          </Text>
        </Row>
        <Text>{formatDate(item.heldAt, true)}</Text>
        {item.place ? <Text muted>{item.place}</Text> : null}
        <Text muted variant="caption">
          {t('consultationAuthor')}: {item.authorName}
        </Text>
        <Text variant="subtitle">{t('consultationMembers')}</Text>
        <Stack>
          {item.members.map((row) => (
            <Row key={row.id}>
              <ProfileAvatar name={row.name} size={28} />
              <Text>{row.name}</Text>
            </Row>
          ))}
        </Stack>
        <Notice tone="warning" emphasis>
          {t('consultationSummaryReminder')}
        </Notice>
        <Text variant="subtitle">{t('consultationSharedSummary')}</Text>
        <Text>{item.sharedSummary || t('consultationNoSummary')}</Text>
        {privateNoteVisible ? (
          <Stack>
            <Text variant="subtitle">{t('consultationPrivateNote')}</Text>
            <Text muted variant="caption">
              {t('consultationPrivateNoteHint')}
            </Text>
            <Text>{privateNote || t('consultationNoPrivateNote')}</Text>
          </Stack>
        ) : null}
      </Stack>
    </Dialog>
  );
}

export function ConsultationsScreen() {
  const t = useFa();
  const me = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [editing, setEditing] = useState(false);
  const canAuthor =
    me.person.orgLevel === 'mentor' || me.person.orgLevel === 'assistant';
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/groups', { params: { query: { page: 1, limit: 100 } } })),
    enabled: canAuthor,
  });
  const authorGroup =
    groups.data?.items.find((group) => group.canManage) ??
    groups.data?.items[0];
  const groupMembers = useQuery({
    queryKey: ['group-members', authorGroup?.id],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/members', {
          params: { path: { id: authorGroup!.id }, query: { page: 1, limit: 100 } },
        })
      ),
    enabled: !!authorGroup?.id && authorGroup.canManage,
  });
  const followedPeople = useQuery({
    queryKey: ['consultation-member-options'],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/people', {
          params: { query: { page: 1, limit: 100 } },
        })
      ),
    enabled: canAuthor && !!authorGroup && !authorGroup.canManage,
  });
  const memberOptions = authorGroup?.canManage
    ? (groupMembers.data?.items ?? [])
        .filter((row) => row.role === 'member')
        .map((row) => ({ id: row.id, name: row.name }))
    : (followedPeople.data?.items ?? [])
        .filter((row) => row.id !== me.person.id && row.orgLevel === 'member')
        .map((row) => ({
          id: row.id,
          name: `${row.firstName} ${row.lastName}`,
        }));
  const query = useQuery({
    queryKey: ['consultations', page, search],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/consultations', {
          params: { query: { page, limit: 15, search: search || undefined } },
        })
      ),
  });
  const detail = useQuery({
    queryKey: ['consultation', selectedId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/consultations/{id}', {
          params: { path: { id: selectedId! } },
        })
      ),
    enabled: !!selectedId,
  });
  const privateNote = useQuery({
    queryKey: ['consultation-private-note', selectedId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/consultations/{id}/private-note', {
          params: { path: { id: selectedId! } },
        })
      ),
    enabled: !!selectedId,
    retry: false,
  });
  const canCreate = canAuthor && !!authorGroup;
  return (
    <Stack>
      <PageHeader
        title={t('consultations')}
        hint={t('consultationsHint')}
        action={
          <Row>
            <Search
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
            />
            {canCreate ? (
              <Button icon="add" onClick={() => setCreating(true)}>
                {t('createConsultation')}
              </Button>
            ) : null}
          </Row>
        }
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
        emptyTitle={t('consultationsEmpty')}
        emptyHint={t(canCreate ? 'consultationsEmptyHint' : 'consultationsMemberHint')}
        emptyAction={
          canCreate ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t('createConsultation')}
            </Button>
          ) : undefined
        }
      >
        <ConsultationCardsGrid>
          {(query.data?.items ?? []).map((item) => (
            <ConsultationCard
              key={item.id}
              item={item}
              onOpen={() => {
                setEditing(false);
                setSelectedId(item.id);
              }}
            />
          ))}
        </ConsultationCardsGrid>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          limit={15}
          total={query.data.total}
          onChange={setPage}
        />
      )}
      {authorGroup && (
        <ConsultationEditor
          open={creating}
          onClose={() => setCreating(false)}
          groupId={authorGroup.id}
          members={memberOptions}
        />
      )}
      {detail.data && selectedId && !editing ? (
        <ConsultationDetailCard
          item={detail.data}
          privateNote={privateNote.data?.body}
          privateNoteVisible={!privateNote.isError && !!privateNote.data}
          onClose={() => setSelectedId(undefined)}
          onEdit={
            detail.data.canManage
              ? () => {
                  setEditing(true);
                }
              : undefined
          }
        />
      ) : null}
      {detail.data && selectedId && editing && authorGroup ? (
        <ConsultationEditor
          open
          onClose={() => {
            setEditing(false);
            setSelectedId(undefined);
          }}
          groupId={detail.data.groupId}
          members={memberOptions}
          initial={detail.data}
          initialPrivateNote={
            privateNote.data?.canWrite ? privateNote.data.body : ''
          }
        />
      ) : null}
      {canAuthor && !authorGroup && !groups.isLoading ? (
        <Notice tone="error">{t('consultationNoGroup')}</Notice>
      ) : null}
    </Stack>
  );
}
