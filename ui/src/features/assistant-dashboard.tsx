'use client';

import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate, calendarDate, formatNumber } from '@safanoor/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Card,
  Chip,
  Form,
  Grid,
  Tabs,
  Text,
  Input,
  Stack,
  Button,
  Notice,
  Search,
  Select,
  Section,
  StatCard,
  StatsGrid,
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
  JalaliInput,
  BottomSheet,
  ProfilePanel,
  ReadingProgress,
  ProfileSectionHeading,
} from 'src/components/ui';

import { useWrite } from './shared';
import { useSession } from './session';

type Member = components['schemas']['AssistantMemberDto'];
type Duty = components['schemas']['AssistantDutyDto'];
type Emergency = components['schemas']['EmergencyCardDto'];
const formSchema = z.object({
  memberId: z.string().uuid(),
  kind: z.enum(['followup', 'task']),
  title: z.string().trim().min(2).max(200),
  due: z.date(),
});
type ItemForm = z.infer<typeof formSchema>;

function NewItem({ member, onClose }: { member: Member; onClose: () => void }) {
  const t = useFa();
  const me = useSession();
  const form = useForm<ItemForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      memberId: member.id,
      kind: 'followup',
      title: '',
      due: new Date(Date.now() + 86400000),
    },
  });
  const write = useWrite(
    async (value: ItemForm) =>
      unwrap(
        await client.POST('/api/v1/assistant/items', {
          body: {
            groupId: me.activeRole!.groupId!,
            memberId: value.memberId,
            kind: value.kind,
            title: value.title,
            dueAt: value.due.toISOString(),
          },
        })
      ),
    onClose
  );
  return (
    <Form onSubmit={form.handleSubmit((value) => write.mutate(value))}>
      <Text variant="subtitle">{member.name}</Text>
      <Controller
        name="kind"
        control={form.control}
        render={({ field }) => (
          <Select
            label={t('assistantKind')}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'followup', label: t('assistantFollowup') },
              { value: 'task', label: t('assistantTask') },
            ]}
          />
        )}
      />
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            label={t('assistantItemTitle')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error ? t('required') : undefined}
            maxLength={200}
          />
        )}
      />
      <Controller
        name="due"
        control={form.control}
        render={({ field, fieldState }) => (
          <JalaliInput
            label={t('assistantDue')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error ? t('invalid') : undefined}
          />
        )}
      />
      <Button type="submit" disabled={write.isPending}>
        {t('save')}
      </Button>
      {write.feedback}
    </Form>
  );
}
function EmergencyCard({ member, onClose }: { member: Member; onClose: () => void }) {
  const t = useFa();
  const [reason, setReason] = useState('urgent_contact');
  const open = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST('/api/v1/assistant/members/{memberId}/emergency', {
          params: { path: { memberId: member.id } },
          body: { reasonCode: reason as 'urgent_contact' | 'camp_incident' | 'medical_help' },
        })
      ),
  });
  const data: Emergency | undefined = open.data;
  return (
    <Stack>
      <Text variant="subtitle">{member.name}</Text>
      {data ? (
        <>
          <Text>
            {t('assistantAge')}: {formatNumber(data.age)}
          </Text>
          <Text>
            {t('assistantEmergencyContact')}: {data.contact || t('assistantEmergencyNone')}
          </Text>
          <Text>
            {t('assistantEmergencyAddress')}: {data.address || t('assistantEmergencyNone')}
          </Text>
          <Text>
            {t('assistantEmergencyMedical')}: {data.medical || t('assistantEmergencyNone')}
          </Text>
          <Button onClick={onClose}>{t('close')}</Button>
        </>
      ) : (
        <>
          <Notice tone="warning">{t('assistantEmergencyHint')}</Notice>
          <Select
            label={t('assistantEmergencyReason')}
            value={reason}
            onChange={setReason}
            options={[
              { value: 'urgent_contact', label: t('assistantEmergencyContactReason') },
              { value: 'camp_incident', label: t('assistantEmergencyCampReason') },
              { value: 'medical_help', label: t('assistantEmergencyMedicalReason') },
            ]}
          />
          <Button onClick={() => open.mutate()} disabled={open.isPending}>
            {t('assistantEmergencyOpen')}
          </Button>
          {open.error && <Notice tone="error">{open.error.message}</Notice>}
        </>
      )}
    </Stack>
  );
}
const sessionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  date: z.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});
export function AssistantSessionCreator() {
  const t = useFa();
  const me = useSession();
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema),
    defaultValues: { title: '', date: new Date(), time: '17:00' },
  });
  const write = useWrite(
    async (value: z.infer<typeof sessionSchema>) => {
      const starts = new Date(value.date);
      const [h, m] = value.time.split(':').map(Number);
      starts.setHours(h, m, 0, 0);
      return unwrap(
        await client.POST('/api/v1/assistant/sessions', {
          body: {
            groupId: me.activeRole!.groupId!,
            title: value.title,
            startsAt: starts.toISOString(),
          },
        })
      );
    },
    () => {
      setOpen(false);
      form.reset();
    }
  );
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        {t('assistantCreateSession')}
      </Button>
      <BottomSheet open={open} title={t('assistantCreateSession')} onClose={() => setOpen(false)}>
        <Text muted>{t('assistantCreateSessionHint')}</Text>
        <Form onSubmit={form.handleSubmit((value) => write.mutate(value))}>
          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                label={t('assistantSessionTitle')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error ? t('required') : undefined}
              />
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <JalaliInput
                label={t('assistantSessionDate')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error ? t('invalid') : undefined}
              />
            )}
          />
          <Controller
            name="time"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                type="time"
                label={t('assistantSessionTime')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error ? t('invalid') : undefined}
              />
            )}
          />
          <Button type="submit" disabled={write.isPending}>
            {t('save')}
          </Button>
          {write.feedback}
        </Form>
      </BottomSheet>
    </>
  );
}
function DutyEditor({ duty, onClose }: { duty: Duty; onClose: () => void }) {
  const t = useFa();
  const form = useForm<{ title: string; date: Date }>({
    resolver: zodResolver(z.object({ title: z.string().trim().min(2).max(200), date: z.date() })),
    defaultValues: { title: duty.title, date: new Date(`${duty.day}T12:00:00`) },
  });
  const write = useWrite(
    async (value: { title: string; date: Date }) =>
      unwrap(
        await client.PATCH('/api/v1/assistant/duties/{dutyId}', {
          params: { path: { dutyId: duty.id } },
          body: { title: value.title, day: calendarDate(value.date) },
        })
      ),
    onClose
  );
  return (
    <Form onSubmit={form.handleSubmit((value) => write.mutate(value))}>
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Input
            label={t('assistantSessionTitle')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error ? t('required') : undefined}
          />
        )}
      />
      <Controller
        name="date"
        control={form.control}
        render={({ field, fieldState }) => (
          <JalaliInput
            label={t('assistantSessionDate')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error ? t('invalid') : undefined}
          />
        )}
      />
      <Button type="submit" disabled={write.isPending}>
        {t('save')}
      </Button>
      {write.feedback}
    </Form>
  );
}
export function AssistantDashboard() {
  const t = useFa();
  const me = useSession();
  const cache = useQueryClient();
  const [tab, setTab] = useState('team'),
    [page, setPage] = useState(1),
    [search, setSearch] = useState('');
  const [itemPage, setItemPage] = useState(1),
    [dutyPage, setDutyPage] = useState(1),
    [sessionPage, setSessionPage] = useState(1);
  const [campFilter, setCampFilter] = useState<string | null>(null);
  const [editDuty, setEditDuty] = useState<Duty | null>(null);
  const [session, setSession] = useState(''),
    [newItem, setNewItem] = useState<Member | null>(null),
    [emergency, setEmergency] = useState<Member | null>(null);
  const enabled = me.capabilities.viewAssistantWorkspace;
  const summary = useQuery({
    queryKey: ['assistant', 'summary'],
    queryFn: async () => unwrap(await client.GET('/api/v1/assistant/summary')),
    enabled,
  });
  const members = useQuery({
    queryKey: ['assistant', 'members', page, search, session, campFilter],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/assistant/members', {
          params: {
            query: {
              page,
              limit: 6,
              search,
              sessionId: session || undefined,
              campId: campFilter || undefined,
            },
          },
        })
      ),
    enabled,
  });
  const items = useQuery({
    queryKey: ['assistant', 'items', itemPage],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/assistant/items', {
          params: { query: { page: itemPage, limit: 8 } },
        })
      ),
    enabled,
  });
  const sessions = useQuery({
    queryKey: ['assistant', 'sessions', sessionPage],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/assistant/sessions', {
          params: { query: { page: sessionPage, limit: 20 } },
        })
      ),
    enabled,
  });
  const duties = useQuery({
    queryKey: ['assistant', 'duties', dutyPage],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/assistant/duties', {
          params: { query: { page: dutyPage, limit: 8 } },
        })
      ),
    enabled,
  });
  const attendance = useMutation({
    mutationFn: async (value: { memberId: string; present: boolean }) =>
      unwrap(
        await client.POST('/api/v1/assistant/attendance', {
          body: { ...value, sessionId: session },
        })
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['assistant'] }),
  });
  const complete = useWrite(async (value: { itemId: string; completed: boolean }) =>
    unwrap(
      await client.PATCH('/api/v1/assistant/items/{itemId}', {
        params: { path: { itemId: value.itemId } },
        body: { completed: value.completed },
      })
    )
  );
  if (!enabled) return <Notice>{t('protectedHint')}</Notice>;
  return (
    <Section>
      <PageHeader title={t('assistantWorkspace')} hint={t('assistantWorkspaceHint')} />
      <QueryState
        loading={summary.isLoading}
        error={summary.error}
        retry={() => void summary.refetch()}
      >
        {summary.data && (
          <>
            <ProfilePanel tone="mint">
              <Stack>
                <ProfileSectionHeading title={summary.data.groupName} icon="groups" />
                <Text>
                  {t(
                    summary.data.mentorAvailable
                      ? 'assistantMentorAvailable'
                      : 'assistantMentorUnavailable',
                    { name: summary.data.mentorName }
                  )}
                </Text>
                <Text muted>{t('assistantWorkloadHint')}</Text>
              </Stack>
            </ProfilePanel>
            <StatsGrid>
              <StatCard
                title={t('assistantTeam')}
                value={summary.data.memberCount}
                icon="people"
                onClick={() => setTab('team')}
              />
              <StatCard
                title={t('assistantPending')}
                value={summary.data.pendingFollowups}
                icon="consultations"
                onClick={() => setTab('items')}
              />
              <StatCard
                title={t('assistantOverdue')}
                value={summary.data.overdueFollowups}
                icon="notifications"
                onClick={() => setTab('items')}
              />
              <StatCard
                title={t('assistantTasks')}
                value={summary.data.openTasks}
                icon="meetings"
                onClick={() => setTab('items')}
              />
            </StatsGrid>
          </>
        )}
      </QueryState>
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setCampFilter(null);
          setPage(1);
          setSearch('');
        }}
        items={[
          { value: 'team', label: t('assistantTeam') },
          { value: 'items', label: t('assistantItems') },
          { value: 'attendance', label: t('assistantAttendance') },
          { value: 'camps', label: t('assistantCamps') },
        ]}
      />
      {(tab === 'team' || tab === 'attendance') && (
        <Stack>
          {campFilter && (
            <Row>
              <Chip>{t('assistantCampCards')}</Chip>
              <Button
                variant="text"
                onClick={() => {
                  setCampFilter(null);
                  setPage(1);
                }}
              >
                {t('assistantAllAssigned')}
              </Button>
            </Row>
          )}
          <Search
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          {tab === 'attendance' && (
            <Card>
              <Stack>
                <Notice>{t('assistantAttendanceHint')}</Notice>
                <QueryState
                  loading={sessions.isLoading}
                  error={sessions.error}
                  retry={() => void sessions.refetch()}
                >
                  {sessions.data?.items.length ? (
                    <>
                      <Select
                        label={t('assistantSession')}
                        value={session}
                        onChange={setSession}
                        options={[
                          { value: '', label: t('assistantSession') },
                          ...sessions.data.items.map((s) => ({
                            value: s.id,
                            label: `${s.title} · ${formatDate(s.startsAt)}`,
                          })),
                        ]}
                      />
                      {sessions.data.total > 20 && (
                        <Pagination
                          page={sessionPage}
                          total={sessions.data.total}
                          limit={20}
                          onChange={setSessionPage}
                        />
                      )}
                    </>
                  ) : (
                    <EmptyState title={t('assistantEmptySessions')} />
                  )}
                </QueryState>
                {attendance.error && <Notice tone="error">{attendance.error.message}</Notice>}
              </Stack>
            </Card>
          )}
          <QueryState
            loading={members.isLoading}
            error={members.error}
            retry={() => void members.refetch()}
          >
            {!members.data?.items.length ? (
              <EmptyState
                title={t(search ? 'assistantNoResults' : 'assistantEmptyTeam')}
                hint={t('assistantEmptyTeamHint')}
              />
            ) : (
              <>
                <Grid>
                  {members.data.items.map((member, index) => (
                    <ProfilePanel key={member.id} tone={index % 2 ? 'lavender' : 'sky'}>
                      <Stack>
                        <ProfileSectionHeading title={member.name} icon="people" />
                        {tab === 'attendance' ? (
                          <>
                            <Chip
                              tone={
                                member.present === true
                                  ? 'success'
                                  : member.present === false
                                    ? 'warning'
                                    : undefined
                              }
                            >
                              {t(
                                member.present === true
                                  ? 'assistantPresent'
                                  : member.present === false
                                    ? 'assistantAbsent'
                                    : 'assistantUnmarked'
                              )}
                            </Chip>
                            <Row>
                              <Button
                                disabled={!session || attendance.isPending}
                                variant={member.present === true ? 'contained' : 'outlined'}
                                onClick={() =>
                                  attendance.mutate({ memberId: member.id, present: true })
                                }
                              >
                                {t('assistantPresent')}
                              </Button>
                              <Button
                                disabled={!session || attendance.isPending}
                                variant={member.present === false ? 'contained' : 'outlined'}
                                onClick={() =>
                                  attendance.mutate({ memberId: member.id, present: false })
                                }
                              >
                                {t('assistantAbsent')}
                              </Button>
                            </Row>
                          </>
                        ) : (
                          <>
                            <Row>
                              <Chip tone={member.verified ? 'success' : 'warning'}>
                                {t(member.verified ? 'verified' : 'unverified')}
                              </Chip>
                              <Chip>
                                {t('assistantTasks')}: {formatNumber(member.openTasks)}
                              </Chip>
                            </Row>
                            {member.attendanceRate === null ? (
                              <Text muted>{t('assistantUnknownAttendance')}</Text>
                            ) : (
                              <>
                                <ReadingProgress
                                  value={member.attendanceRate}
                                  label={t('assistantAttendanceRate', {
                                    rate: formatNumber(member.attendanceRate),
                                  })}
                                />
                                <Text muted variant="caption">
                                  {t('assistantAttendanceBasis', {
                                    count: formatNumber(member.recordedSessions),
                                  })}
                                </Text>
                              </>
                            )}
                            <Text>
                              {member.nextFollowup
                                ? t('assistantNextFollowup', {
                                    date: formatDate(member.nextFollowup),
                                  })
                                : t('assistantNoFollowup')}
                            </Text>
                            {member.overdueFollowups > 0 && (
                              <Chip tone="warning">
                                {t('assistantOverdue')}: {formatNumber(member.overdueFollowups)}
                              </Chip>
                            )}
                            <Button onClick={() => setNewItem(member)}>
                              {t('assistantNewItem')}
                            </Button>
                            <Row>
                              <Button href="/consultations" variant="text">
                                {t('consultations')}
                              </Button>
                              <Button href="/communications" variant="text">
                                {t('communications')}
                              </Button>
                              <Button onClick={() => setEmergency(member)} variant="text">
                                {t('assistantEmergency')}
                              </Button>
                            </Row>
                          </>
                        )}
                      </Stack>
                    </ProfilePanel>
                  ))}
                </Grid>
                <Pagination page={page} total={members.data.total} limit={6} onChange={setPage} />
              </>
            )}
          </QueryState>
        </Stack>
      )}
      {tab === 'items' && (
        <QueryState
          loading={items.isLoading}
          error={items.error}
          retry={() => void items.refetch()}
        >
          {!items.data?.items.length ? (
            <EmptyState title={t('assistantEmptyItems')} />
          ) : (
            <Stack>
              {items.data.items.map((item) => (
                <ProfilePanel tone={item.kind === 'task' ? 'sky' : 'peach'} key={item.id}>
                  <Stack>
                    <Row>
                      <Chip>{t(item.kind === 'task' ? 'assistantTask' : 'assistantFollowup')}</Chip>
                      {item.completedAt && <Chip tone="success">{t('assistantCompleted')}</Chip>}
                    </Row>
                    <Text variant="subtitle">{item.title}</Text>
                    <Text>{item.memberName}</Text>
                    <Text muted>
                      {t('assistantDue')}: {formatDate(item.dueAt)}
                    </Text>
                    <Button
                      disabled={complete.isPending}
                      variant="outlined"
                      onClick={() =>
                        complete.mutate({ itemId: item.id, completed: !item.completedAt })
                      }
                    >
                      {t(item.completedAt ? 'assistantReopen' : 'assistantComplete')}
                    </Button>
                  </Stack>
                </ProfilePanel>
              ))}
              <Pagination
                page={itemPage}
                total={items.data.total}
                limit={8}
                onChange={setItemPage}
              />
            </Stack>
          )}
          {complete.feedback}
        </QueryState>
      )}
      {tab === 'camps' && (
        <QueryState
          loading={duties.isLoading}
          error={duties.error}
          retry={() => void duties.refetch()}
        >
          {!duties.data?.items.length ? (
            <EmptyState title={t('assistantEmptyDuties')} />
          ) : (
            <Stack>
              {duties.data.items.map((duty) => (
                <ProfilePanel key={duty.id} tone="peach">
                  <Stack>
                    <ProfileSectionHeading title={duty.campTitle} icon="campAttendance" />
                    <Text>{duty.title}</Text>
                    <Text muted>{formatDate(duty.day)}</Text>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCampFilter(duty.campId);
                        setTab('team');
                        setPage(1);
                      }}
                    >
                      {t('assistantCampCards')}
                    </Button>
                    <Button onClick={() => setEditDuty(duty)}>{t('assistantEditDuty')}</Button>
                    <Button href="/camp-attendance" variant="outlined">
                      {t('assistantCampView')}
                    </Button>
                  </Stack>
                </ProfilePanel>
              ))}
              <Pagination
                page={dutyPage}
                total={duties.data.total}
                limit={8}
                onChange={setDutyPage}
              />
            </Stack>
          )}
        </QueryState>
      )}
      <BottomSheet
        open={!!editDuty}
        title={t('assistantEditDuty')}
        onClose={() => setEditDuty(null)}
      >
        {editDuty && <DutyEditor duty={editDuty} onClose={() => setEditDuty(null)} />}
      </BottomSheet>
      <BottomSheet open={!!newItem} title={t('assistantNewItem')} onClose={() => setNewItem(null)}>
        {newItem && <NewItem member={newItem} onClose={() => setNewItem(null)} />}
      </BottomSheet>
      <BottomSheet
        open={!!emergency}
        title={t('assistantEmergency')}
        onClose={() => setEmergency(null)}
      >
        {emergency && <EmergencyCard member={emergency} onClose={() => setEmergency(null)} />}
      </BottomSheet>
    </Section>
  );
}
