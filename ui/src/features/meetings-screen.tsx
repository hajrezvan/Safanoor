'use client';

import type { components } from 'src/api/generated/schema';
import type { TextKey } from 'src/locales/fa';

import { z } from 'zod';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarDate, formatDate, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import {
  Button,
  Card,
  Check,
  Chip,
  Dialog,
  EmptyState,
  Form,
  FormGrid,
  Input,
  JalaliInput,
  Notice,
  PageHeader,
  Pagination,
  QueryState,
  Row,
  Select,
  Stack,
  Text,
} from 'src/components/ui';

import { useSession } from './session';
import { useWrite } from './shared';

type MeetingSummary = components['schemas']['MeetingSummaryDto'];
type MeetingDetail = components['schemas']['MeetingDetailDto'];
type GroupMember = components['schemas']['MembersPageDto']['items'][number];

const meetingFormSchema = z.object({
  title: z.string().trim().min(2),
  heldDate: z.date({ required_error: 'required' }),
  heldTime: z.string().regex(/^\d{2}:\d{2}$/),
  place: z.string().max(200),
  kind: z.enum(['public', 'workgroup']),
  attendeeIds: z.array(z.string().uuid()).min(1),
  agenda: z.string().max(8000),
  resolutions: z.array(
    z.object({
      text: z.string().trim().min(1).max(2000),
      assigneeId: z.string(),
      dueDate: z.date().nullable(),
    })
  ),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

function combineHeldAt(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next.toISOString();
}

function previewAttendees(preview: string, count: number, t: ReturnType<typeof useFa>) {
  if (!preview) return t('meetingAttendeeCount', { count: formatNumber(count) });
  const names = preview.split('، ').filter(Boolean);
  if (names.length <= 3 && names.length >= count)
    return names.join('، ');
  const shown = names.slice(0, 3).join('، ');
  return `${shown} · ${t('meetingAttendeeCount', { count: formatNumber(count) })}`;
}

function MeetingCard({
  meeting,
  onOpen,
}: {
  meeting: MeetingSummary;
  onOpen: () => void;
}) {
  const t = useFa();
  return (
    <Card>
      <Stack>
        <Row>
          <Text variant="subtitle">{meeting.title}</Text>
          <Chip tone={meeting.kind === 'public' ? 'success' : 'default'}>
            {t(meeting.kind === 'public' ? 'meetingKindPublic' : 'meetingKindWorkgroup')}
          </Chip>
        </Row>
        <Text muted>
          {formatDate(meeting.heldAt, true)}
          {meeting.place ? ` · ${meeting.place}` : ''}
        </Text>
        <Text muted variant="caption">
          {previewAttendees(meeting.attendeePreview, meeting.attendeeCount, t)}
        </Text>
        <Button variant="outlined" onClick={onOpen}>
          {t('meetingAgenda')}
        </Button>
      </Stack>
    </Card>
  );
}

function MeetingEditor({
  open,
  onClose,
  groupId,
  members,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
  initial?: MeetingDetail;
}) {
  const t = useFa();
  const cache = useQueryClient();
  const defaults = useMemo<MeetingFormValues>(() => {
    if (!initial) {
      return {
        title: '',
        heldDate: new Date(),
        heldTime: '18:00',
        place: '',
        kind: 'public',
        attendeeIds: members.map((member) => member.id),
        agenda: '',
        resolutions: [],
      };
    }
    const held = new Date(initial.heldAt);
    return {
      title: initial.title,
      heldDate: held,
      heldTime: `${String(held.getHours()).padStart(2, '0')}:${String(held.getMinutes()).padStart(2, '0')}`,
      place: initial.place ?? '',
      kind: initial.kind,
      attendeeIds: initial.attendees.map((row) => row.id),
      agenda: initial.agenda,
      resolutions: initial.resolutions.map((row) => ({
        text: row.text,
        assigneeId: row.assigneeId ?? '',
        dueDate: row.dueDate ? new Date(`${row.dueDate}T12:00:00`) : null,
      })),
    };
  }, [initial, members]);
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    values: defaults,
  });
  const resolutions = useFieldArray({ control: form.control, name: 'resolutions' });
  const selected = form.watch('attendeeIds');
  const save = useWrite(async (values: MeetingFormValues) => {
    const body = {
      title: values.title,
      heldAt: combineHeldAt(values.heldDate, values.heldTime),
      place: values.place.trim() || undefined,
      kind: values.kind,
      attendeeIds: values.attendeeIds,
      agenda: values.agenda,
      resolutions: values.resolutions.map((row) => ({
        text: row.text,
        assigneeId: row.assigneeId || null,
        dueDate: row.dueDate ? calendarDate(row.dueDate) : null,
      })),
    };
    if (initial) {
      return unwrap(
        await client.PATCH('/api/v1/meetings/{id}', {
          params: { path: { id: initial.id } },
          body,
        })
      );
    }
    return unwrap(
      await client.POST('/api/v1/meetings', {
        body: { ...body, groupId },
      })
    );
  }, () => {
    void cache.invalidateQueries({ queryKey: ['meetings'] });
    if (initial) void cache.invalidateQueries({ queryKey: ['meeting', initial.id] });
    onClose();
  });
  return (
    <Dialog
      open={open}
      title={t(initial ? 'editMeeting' : 'createMeeting')}
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
            {t(save.isPending ? 'busy' : 'saveMeeting')}
          </Button>
        </Row>
      }
    >
      <Form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormGrid>
          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label={t('meetingTitle')}
                error={fieldState.error ? t('required') : undefined}
              />
            )}
          />
          <Controller
            name="heldDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <JalaliInput
                label={t('meetingHeldAt')}
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
                label={t('meetingTime')}
                type="time"
                error={fieldState.error ? t('invalid') : undefined}
              />
            )}
          />
          <Controller
            name="place"
            control={form.control}
            render={({ field }) => <Input {...field} label={t('meetingPlace')} />}
          />
          <Controller
            name="kind"
            control={form.control}
            render={({ field }) => (
              <Select
                label={t('meetingKind')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'public', label: t('meetingKindPublic') },
                  { value: 'workgroup', label: t('meetingKindWorkgroup') },
                ]}
              />
            )}
          />
        </FormGrid>
        <Text variant="subtitle">{t('meetingAttendees')}</Text>
        <Stack>
          {members.map((member) => (
            <Check
              key={member.id}
              label={`${member.name} (${t(member.role as TextKey)})`}
              checked={selected.includes(member.id)}
              onChange={(checked) => {
                const next = checked
                  ? [...selected, member.id]
                  : selected.filter((id) => id !== member.id);
                form.setValue('attendeeIds', next, { shouldValidate: true });
              }}
            />
          ))}
          {form.formState.errors.attendeeIds && <Notice tone="error">{t('required')}</Notice>}
        </Stack>
        <Controller
          name="agenda"
          control={form.control}
          render={({ field }) => (
            <Input {...field} label={t('meetingAgenda')} multiline />
          )}
        />
        <Row>
          <Text variant="subtitle">{t('meetingResolutions')}</Text>
          <Button
            variant="text"
            icon="add"
            onClick={() => resolutions.append({ text: '', assigneeId: '', dueDate: null })}
          >
            {t('addResolution')}
          </Button>
        </Row>
        {resolutions.fields.map((field, index) => (
          <Card key={field.id}>
            <Stack>
              <Controller
                name={`resolutions.${index}.text`}
                control={form.control}
                render={({ field: control, fieldState }) => (
                  <Input
                    {...control}
                    label={t('resolutionText')}
                    error={fieldState.error ? t('required') : undefined}
                  />
                )}
              />
              <Controller
                name={`resolutions.${index}.assigneeId`}
                control={form.control}
                render={({ field: control }) => (
                  <Select
                    label={t('resolutionAssignee')}
                    value={control.value}
                    onChange={control.onChange}
                    options={[
                      { value: '', label: t('noAssignee') },
                      ...members.map((member) => ({
                        value: member.id,
                        label: member.name,
                      })),
                    ]}
                  />
                )}
              />
              <Controller
                name={`resolutions.${index}.dueDate`}
                control={form.control}
                render={({ field: control }) => (
                  <JalaliInput
                    label={t('resolutionDue')}
                    value={control.value}
                    onChange={control.onChange}
                  />
                )}
              />
              <Button
                color="error"
                variant="text"
                onClick={() => resolutions.remove(index)}
              >
                {t('cancel')}
              </Button>
            </Stack>
          </Card>
        ))}
        {save.feedback}
      </Form>
    </Dialog>
  );
}

export function MeetingsScreen() {
  const t = useFa();
  const me = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/groups', { params: { query: { page: 1, limit: 100 } } })),
  });
  const owned = groups.data?.items.find((group) => group.canManage);
  const members = useQuery({
    queryKey: ['group-members', owned?.id],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/members', {
          params: { path: { id: owned!.id }, query: { page: 1, limit: 100 } },
        })
      ),
    enabled: !!owned?.id,
  });
  const query = useQuery({
    queryKey: ['meetings', page],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/meetings', {
          params: { query: { page, limit: 15 } },
        })
      ),
  });
  const canCreate = !!owned && me.person.orgLevel === 'mentor';
  return (
    <Stack>
      <PageHeader
        title={t('meetings')}
        hint={t('meetingsHint')}
        action={
          canCreate ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t('createMeeting')}
            </Button>
          ) : undefined
        }
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
        emptyTitle={t('meetingsEmpty')}
        emptyHint={t('meetingsEmptyHint')}
        emptyAction={
          canCreate ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t('createMeeting')}
            </Button>
          ) : undefined
        }
      >
        <Stack>
          {(query.data?.items ?? []).map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onOpen={() => router.push(`/meetings/${meeting.id}`)}
            />
          ))}
        </Stack>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          limit={15}
          total={query.data.total}
          onChange={setPage}
        />
      )}
      {owned && (
        <MeetingEditor
          open={creating}
          onClose={() => setCreating(false)}
          groupId={owned.id}
          members={members.data?.items ?? []}
        />
      )}
    </Stack>
  );
}

export function MeetingDetailScreen({ id }: { id: string }) {
  const t = useFa();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/meetings/{id}', {
          params: { path: { id } },
        })
      ),
  });
  const members = useQuery({
    queryKey: ['group-members', query.data?.groupId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/members', {
          params: {
            path: { id: query.data!.groupId },
            query: { page: 1, limit: 100 },
          },
        })
      ),
    enabled: !!query.data?.groupId && !!query.data.canManage,
  });
  const meeting = query.data;
  return (
    <Stack>
      <PageHeader
        title={meeting?.title ?? t('meetings')}
        hint={meeting ? formatDate(meeting.heldAt, true) : undefined}
        action={
          <Row>
            <Button variant="text" onClick={() => router.push('/meetings')}>
              {t('backToMeetings')}
            </Button>
            {meeting?.canManage && (
              <Button variant="outlined" onClick={() => setEditing(true)}>
                {t('editMeeting')}
              </Button>
            )}
          </Row>
        }
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!meeting}
        retry={() => void query.refetch()}
      >
        {meeting && (
          <Stack>
            <Card>
              <Stack>
                <Row>
                  <Chip>
                    {t(
                      meeting.kind === 'public'
                        ? 'meetingKindPublic'
                        : 'meetingKindWorkgroup'
                    )}
                  </Chip>
                  {meeting.place && <Text muted>{meeting.place}</Text>}
                </Row>
                <Text variant="subtitle">{t('meetingAttendees')}</Text>
                <Text>
                  {meeting.attendees.map((row) => row.name).join('، ') ||
                    t('meetingAttendeeCount', {
                      count: formatNumber(meeting.attendeeCount),
                    })}
                </Text>
              </Stack>
            </Card>
            <Card>
              <Stack>
                <Text variant="subtitle">{t('meetingAgenda')}</Text>
                <Text>{meeting.agenda || t('empty')}</Text>
              </Stack>
            </Card>
            <Card>
              <Stack>
                <Text variant="subtitle">{t('meetingResolutions')}</Text>
                {meeting.resolutions.length === 0 && <EmptyState title={t('empty')} />}
                {meeting.resolutions.map((row) => (
                  <Stack key={row.id}>
                    <Text>{row.text}</Text>
                    <Text muted variant="caption">
                      {[
                        row.assigneeName || t('noAssignee'),
                        row.dueDate ? formatDate(row.dueDate) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            </Card>
          </Stack>
        )}
      </QueryState>
      {meeting?.canManage && (
        <MeetingEditor
          open={editing}
          onClose={() => setEditing(false)}
          groupId={meeting.groupId}
          members={members.data?.items ?? meeting.attendees.map((row) => ({
            id: row.id,
            name: row.name,
            role: 'member',
          }))}
          initial={meeting}
        />
      )}
    </Stack>
  );
}
