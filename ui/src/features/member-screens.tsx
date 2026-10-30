'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  orgLevels,
  formatDate,
  loginSchema,
  calendarDate,
  personSchema,
  type PersonInput,
} from '@safanoor/shared';

import { useFa } from 'src/locales/fa-provider';
import { api, client, unwrap } from 'src/api/client';

import {
  Row,
  Card,
  Chip,
  Form,
  Grid,
  Hero,
  Text,
  Check,
  Input,
  Stack,
  Button,
  Notice,
  Select,
  Section,
  FeedItem,
  FormGrid,
  AuthShell,
  PageHeader,
  Pagination,
  QueryState,
  JalaliInput,
} from 'src/components/ui';

import { useSession, useLogout } from './session';
import { MentorHomeDashboard } from './mentor-dashboard';
import { useWrite, BasicForm } from './shared';

export function LoginScreen() {
  const t = useFa();
  const router = useRouter();
  const cache = useQueryClient();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  });
  const mutation = useWrite(api.login, () => {
    cache.clear();
    router.replace('/');
  });
  return (
    <AuthShell>
      <Form onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
        <PageHeader title={t('login')} hint={t('loginHint')} />
        <Controller
          name="login"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label={t('phone')}
              type="tel"
              autoComplete="username"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label={t('password')}
              type="password"
              autoComplete="current-password"
              error={fieldState.error?.message}
            />
          )}
        />
        {mutation.feedback}
        <Button type="submit" disabled={mutation.isPending}>
          {t(mutation.isPending ? 'busy' : 'signIn')}
        </Button>
      </Form>
    </AuthShell>
  );
}
export function HomeScreen() {
  const me = useSession();
  const t = useFa();
  if (
    me.person.orgLevel === 'mentor' ||
    me.person.orgLevel === 'head_mentor'
  ) {
    return (
      <>
        {me.consentRequired && (
          <Notice tone="warning">
            <Button href="/consent" variant="text">
              {t('consentPending')}
            </Button>
          </Notice>
        )}
        <MentorHomeDashboard name={me.person.firstName} />
      </>
    );
  }
  return (
    <>
      <Hero name={me.person.firstName} />
      {me.children.length > 0 && (
        <Card>
          <Stack>
            <Text variant="subtitle">{t('myChildren')}</Text>
            {me.children.map((child) => (
              <Text key={child.id}>{child.name}</Text>
            ))}
            <Button href="/consent" variant="outlined">
              {t('consent')}
            </Button>
          </Stack>
        </Card>
      )}
      {me.consentRequired && (
        <Notice tone="warning">
          <Button href="/consent" variant="text">
            {t('consentPending')}
          </Button>
        </Notice>
      )}
      <Grid>
        <Card>
          <Stack>
            <Row>
              <Chip tone="success">{t(me.person.orgLevel as TextKey)}</Chip>
              <Chip>{t(me.person.verified ? 'verified' : 'unverified')}</Chip>
            </Row>
            <Text variant="subtitle">{t('myGroup')}</Text>
            <Text>{me.person.groupName || t('empty')}</Text>
            <Button href="/profile" variant="outlined">
              {t('identity')}
            </Button>
          </Stack>
        </Card>
        <Card>
          <Stack>
            <Text variant="subtitle">{t('private')}</Text>
            <Text muted>{t('privacyHint')}</Text>
            <Button href="/consent" variant="text">
              {t('consent')}
            </Button>
          </Stack>
        </Card>
      </Grid>
    </>
  );
}
function notificationText(type: string, t: ReturnType<typeof useFa>) {
  const key = `notification.${type}` as TextKey;
  const text = t(key);
  return text === key ? t('notifications') : text;
}
function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}
export function NotificationsScreen() {
  const t = useFa();
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['notifications', page];
  const query = useQuery({ queryKey: key, queryFn: () => api.notifications(page) });
  const respond = useWrite(async (input: { inviteId: string; decision: 'accepted' | 'rejected' }) =>
    unwrap(
      await client.POST('/api/v1/assistant-invites/{id}/respond', {
        params: { path: { id: input.inviteId } },
        body: { decision: input.decision },
      })
    )
  );
  const read = async (id: string) => {
    const previous = query.data;
    cache.setQueryData(
      key,
      previous
        ? {
            ...previous,
            items: previous.items.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item
            ),
          }
        : previous
    );
    try {
      unwrap(await client.POST('/api/v1/notifications/{id}/read', { params: { path: { id } } }));
    } catch {
      cache.setQueryData(key, previous);
    }
  };
  return (
    <>
      <PageHeader title={t('notifications')} hint={t('notificationHint')} />
      {respond.feedback}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
      >
        <Card>
          <Stack>
            {query.data?.items.map((note) => {
              const inviteId = payloadString(note.payload, 'inviteId');
              const status = payloadString(note.payload, 'status');
              const mentorName = payloadString(note.payload, 'mentorName');
              const groupName = payloadString(note.payload, 'groupName');
              const pendingInvite =
                note.type === 'assistant.invite' && inviteId && status !== 'accepted' && status !== 'rejected';
              const title = notificationText(note.type, t);
              const detail =
                note.type === 'assistant.invite' && (mentorName || groupName)
                  ? [mentorName, groupName].filter(Boolean).join(' · ')
                  : undefined;
              return (
                <Stack key={note.id}>
                  <FeedItem
                    title={detail ? `${title} — ${detail}` : title}
                    time={formatDate(note.createdAt, true)}
                    unread={!note.readAt}
                    onRead={() => {
                      if (!note.readAt) void read(note.id);
                    }}
                  />
                  {pendingInvite && (
                    <Row>
                      <Button
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ inviteId, decision: 'accepted' })
                        }
                      >
                        {t('acceptInvite')}
                      </Button>
                      <Button
                        color="error"
                        variant="text"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ inviteId, decision: 'rejected' })
                        }
                      >
                        {t('rejectInvite')}
                      </Button>
                    </Row>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Card>
      </QueryState>
      {query.data && (
        <Pagination page={page} limit={15} total={query.data.total} onChange={setPage} />
      )}
    </>
  );
}
export function ProfileScreen() {
  const me = useSession();
  const logout = useLogout();
  const t = useFa();
  const router = useRouter();
  const change = useWrite(
    async (value: Record<string, string>) =>
      unwrap(
        await client.POST('/api/v1/auth/password', {
          body: { currentPassword: value.currentPassword, newPassword: value.newPassword },
        })
      ),
    () => router.replace('/auth/jwt/sign-in')
  );
  return (
    <>
      <PageHeader title={t('profile')} hint={t('identityHint')} />
      <Card>
        <Stack>
          <Row>
            <Chip>{t(me.person.orgLevel as TextKey)}</Chip>
            <Chip tone={me.person.verified ? 'success' : 'warning'}>
              {t(me.person.verified ? 'verified' : 'unverified')}
            </Chip>
          </Row>
          <Text muted>
            {t('nationalIdMasked')}: {me.person.nationalIdMasked}
          </Text>
          <PersonForm person={me.person} />
        </Stack>
      </Card>
      <Card>
        <Section>
          <Text variant="subtitle">{t('changePassword')}</Text>
          <BasicForm
            fields={[
              { key: 'currentPassword', label: 'currentPassword', type: 'password' },
              { key: 'newPassword', label: 'newPassword', type: 'password' },
            ]}
            onSubmit={change.mutate}
            busy={change.isPending}
          />
          {change.feedback}
        </Section>
      </Card>
      <Button color="error" variant="outlined" icon="logout" onClick={() => void logout()}>
        {t('logout')}
      </Button>
    </>
  );
}
export function PersonForm({
  person,
  groups = [],
  onSaved,
}: {
  person?: components['schemas']['PersonDto'];
  groups?: components['schemas']['GroupDto'][];
  onSaved?: () => void;
}) {
  const t = useFa();
  const me = useSession();
  const mentorView = me.person.orgLevel === 'mentor';
  const mentorGroupId =
    groups.find((group) => group.ownerPersonId === me.person.id)?.id ??
    groups.find((group) => group.canManage)?.id ??
    me.person.groupId ??
    '';
  const [groupId, setGroupId] = useState(person?.groupId ?? (mentorView ? mentorGroupId : ''));
  const [orgLevel, setOrgLevel] = useState('member');
  const form = useForm<Partial<PersonInput>>({
    resolver: zodResolver(
      person ? personSchema.omit({ orgLevel: true, groupId: true }).partial() : personSchema
    ) as Resolver<Partial<PersonInput>>,
    defaultValues: person
      ? {
          firstName: person.firstName,
          lastName: person.lastName,
          fatherName: person.fatherName ?? '',
          phone: person.phone ?? '',
          birthDate: person.birthDate ?? '',
          nationalId: '',
        }
      : {
          firstName: '',
          lastName: '',
          fatherName: '',
          phone: '',
          nationalId: '',
          birthDate: '',
          orgLevel: 'member',
          groupId: mentorView ? mentorGroupId : undefined,
        },
  });
  const write = useWrite(async (values: Partial<PersonInput>) => {
    const compact = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== '' && value !== undefined)
    ) as Partial<PersonInput>;
    if (person) {
      const { orgLevel: _level, groupId: _group, ...data } = compact;
      return unwrap(
        await client.PATCH('/api/v1/people/{id}', {
          params: { path: { id: person.id } },
          body: data,
        })
      );
    }
    const nextOrgLevel = mentorView ? 'member' : (compact.orgLevel ?? orgLevel);
    const nextGroupId = mentorView ? mentorGroupId : compact.groupId || groupId || undefined;
    return unwrap(
      await client.POST('/api/v1/people', {
        body: {
          ...compact,
          orgLevel: nextOrgLevel,
          groupId: nextGroupId,
        } as PersonInput,
      })
    );
  }, onSaved);
  const submit = form.handleSubmit((value) => write.mutate(value));
  return (
    <Form onSubmit={submit}>
      <FormGrid>
        {(['firstName', 'lastName', 'fatherName', 'phone'] as const).map((key) => (
          <Controller
            key={key}
            name={key}
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                value={field.value ?? ''}
                label={t(key)}
                type={key === 'phone' ? 'tel' : 'text'}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        <Controller
          name="nationalId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              value={field.value ?? ''}
              label={t('nationalId')}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="birthDate"
          control={form.control}
          render={({ field, fieldState }) => (
            <JalaliInput
              label={t('birthDate')}
              value={field.value ? new Date(`${field.value}T12:00:00`) : null}
              onChange={(date) =>
                field.onChange(date && !Number.isNaN(date.valueOf()) ? calendarDate(date) : '')
              }
              error={fieldState.error?.message}
            />
          )}
        />
        {!person && !mentorView && (
          <>
            <Controller
              name="orgLevel"
              control={form.control}
              render={({ field }) => (
                <Select
                  label={t('orgLevel')}
                  value={field.value ?? orgLevel}
                  onChange={(value) => {
                    field.onChange(value);
                    setOrgLevel(value);
                  }}
                  options={orgLevels.map((value) => ({ value, label: t(value) }))}
                />
              )}
            />
            <Controller
              name="groupId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Select
                  label={t('group')}
                  value={field.value ?? groupId}
                  onChange={(value) => {
                    field.onChange(value);
                    setGroupId(value);
                  }}
                  error={fieldState.error?.message}
                  options={groups.map((group) => ({ value: group.id, label: group.name }))}
                />
              )}
            />
          </>
        )}
      </FormGrid>
      {write.feedback}
      <Button type="submit" disabled={write.isPending || person?.capabilities.update === false}>
        {t(write.isPending ? 'busy' : 'save')}
      </Button>
    </Form>
  );
}
export function ConsentScreen() {
  const me = useSession();
  const t = useFa();
  const [personId, setPersonId] = useState(
    me.consentRequired ? me.person.id : (me.children[0]?.id ?? me.person.id)
  );
  const query = useQuery({ queryKey: ['consent', personId], queryFn: () => api.consent(personId) });
  const [accepted, setAccepted] = useState<string[]>([]);
  const write = useWrite(async () =>
    unwrap(
      await client.POST('/api/v1/consent/records', {
        body: {
          personId,
          versionId: query.data!.version.id,
          acceptedItems: accepted as (
            | 'system'
            | 'retention'
            | 'public_photos'
            | 'public_audio'
            | 'parent_summary_notice'
          )[],
        },
      })
    )
  );
  return (
    <>
      <PageHeader title={t('consent')} hint={t('consentHint')} />
      {me.children.length > 0 && (
        <Select
          label={t('child')}
          value={personId}
          onChange={(value) => {
            setPersonId(value);
            setAccepted([]);
          }}
          options={[
            { value: me.person.id, label: t('profile') },
            ...me.children.map((child) => ({ value: child.id, label: child.name })),
          ]}
        />
      )}
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {query.data && (
          <Card>
            <Section>
              <Row>
                <Text variant="subtitle">{query.data.version.title}</Text>
                <Chip>
                  {t('version')} {query.data.version.version}
                </Chip>
              </Row>
              {!query.data.canSign && <Notice>{t('consentParent')}</Notice>}
              {query.data.version.items.map((item) => (
                <Check
                  key={item.key}
                  label={`${item.text}${item.required ? '' : ` (${t('optional')})`}`}
                  checked={accepted.includes(item.key)}
                  disabled={!query.data?.canSign}
                  onChange={(checked) =>
                    setAccepted((old) =>
                      checked ? [...old, item.key] : old.filter((key) => key !== item.key)
                    )
                  }
                />
              ))}
              {write.feedback}
              <Button
                disabled={
                  !query.data.canSign ||
                  write.isPending ||
                  query.data.version.items.some(
                    (item) => item.required && !accepted.includes(item.key)
                  )
                }
                onClick={() => write.mutate(undefined)}
              >
                {t('acceptConsent')}
              </Button>
            </Section>
          </Card>
        )}
      </QueryState>
    </>
  );
}
