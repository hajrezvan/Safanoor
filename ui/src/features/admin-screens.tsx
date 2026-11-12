'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDate, formatNumber, normalizePhone } from '@safanoor/shared';

import { codeText } from 'src/locales/fa';
import { useFa } from 'src/locales/fa-provider';
import { api, client, unwrap } from 'src/api/client';

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
  Avatar,
  Button,
  Dialog,
  Search,
  Select,
  CardNav,
  Section,
  DataTable,
  FileInput,
  IconAction,
  PageHeader,
  Pagination,
  EmptyState,
  QueryState,
  PersonCardRow,
  PersonCardMeta,
  PeopleCardBody,
  PeopleCardChips,
  PeopleCardsGrid,
  PeoplePersonCard,
  PeopleCardActions,
} from 'src/components/ui';

import { useSession } from './session';
import { PersonForm } from './member-screens';
import { PersonPicker } from './person-picker';
import { AssistantDashboard } from './assistant-dashboard';
import { useWrite, BasicForm, Permission } from './shared';

type Person = components['schemas']['PersonDto'];

function inviteStatusTone(status: string): 'warning' | 'success' | 'error' | 'default' {
  if (status === 'pending') return 'warning';
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'error';
  return 'default';
}
function inviteStatusKey(status: string): TextKey {
  if (status === 'accepted') return 'inviteAccepted';
  if (status === 'rejected') return 'inviteRejected';
  return 'invitePending';
}
export function PeopleScreen() {
  const t = useFa();
  const me = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'coaching' ? 'coaching' : 'forces';
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Person>();
  const [account, setAccount] = useState<Person>();
  const [parentChild, setParentChild] = useState<Person>();
  const [inviting, setInviting] = useState(false);
  const [inviteeId, setInviteeId] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const query = useQuery({
    queryKey: ['people', page, search],
    queryFn: () => api.people(page, search),
  });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api.groups() });
  const managedGroup = groups.data?.items.find(
    (group) => group.ownerPersonId === me.person.id
  );
  const invites = useQuery({
    queryKey: ['assistant-invites', managedGroup?.id],
    enabled: tab === 'coaching' && !!managedGroup?.id,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/assistant-invites', {
          params: { path: { id: managedGroup!.id }, query: { page: 1, limit: 100 } },
        })
      ),
  });
  const candidates = useQuery({
    queryKey: ['assistant-invite-candidates', managedGroup?.id, candidateSearch],
    enabled: inviting && !!managedGroup?.id,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/assistant-invite-candidates', {
          params: {
            path: { id: managedGroup!.id },
            query: { page: 1, limit: 30, search: candidateSearch },
          },
        })
      ),
  });
  const verify = useWrite(async (id: string) =>
    unwrap(await client.POST('/api/v1/people/{id}/verify', { params: { path: { id } } }))
  );
  const deactivate = useWrite(
    async () =>
      unwrap(
        await client.POST('/api/v1/people/{id}/deactivate', {
          params: { path: { id: deleting!.id } },
        })
      ),
    () => setDeleting(undefined)
  );
  const provision = useWrite(
    async (values: Record<string, string>) =>
      unwrap(
        await client.POST('/api/v1/admin/accounts', {
          body: { personId: account!.id, password: values.password },
        })
      ),
    () => setAccount(undefined)
  );
  const parentLink = useWrite(
    async (values: Record<string, string>) =>
      unwrap(
        await client.POST('/api/v1/admin/parent-links', {
          body: { parentPhone: normalizePhone(values.parentPhone), childPersonId: parentChild!.id },
        })
      ),
    () => setParentChild(undefined)
  );
  const sendInvite = useWrite(
    async () =>
      unwrap(
        await client.POST('/api/v1/groups/{id}/assistant-invites', {
          params: { path: { id: managedGroup!.id } },
          body: { inviteePersonId: inviteeId },
        })
      ),
    () => {
      setInviting(false);
      setInviteeId('');
    }
  );
  const mentorView = me.person.orgLevel === 'mentor';
  const people = mentorView
    ? (query.data?.items ?? []).filter((person) => person.orgLevel === 'member')
    : (query.data?.items ?? []);
  const total = mentorView ? people.length : (query.data?.total ?? 0);
  if (me.capabilities.viewAssistantWorkspace) return <AssistantDashboard />;
  return (
    <Permission allowed={me.capabilities.managePeople}>
      <PageHeader
        title={t(mentorView ? 'myGroup' : 'people')}
        hint={mentorView ? undefined : t('peopleHint')}
        action={
          tab === 'forces' ? (
            <Button icon="add" iconOnlyOnMobile onClick={() => setEditing(null)}>
              {t('create')}
            </Button>
          ) : managedGroup ? (
            <Button
              icon="add"
              iconOnlyOnMobile
              onClick={() => {
                setInviteeId('');
                setCandidateSearch('');
                setInviting(true);
              }}
            >
              {t('inviteAssistant')}
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          router.replace(
            next === 'coaching' ? '/admin/people?tab=coaching' : '/admin/people'
          );
        }}
        items={[
          { value: 'forces', label: t('forces') },
          { value: 'coaching', label: t('coachingTeam') },
        ]}
      />
      {tab === 'forces' ? (
        <>
          <Search
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          {verify.feedback}
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={people.length === 0}
            retry={() => void query.refetch()}
          >
            <Stack>
              <Text muted>
                {t('total')}: {formatNumber(total)}
              </Text>
              <PeopleCardsGrid>
                {people.map((person) => {
                  const fullName = `${person.firstName} ${person.lastName}`;
                  return (
                    <PeoplePersonCard key={person.id}>
                      <PeopleCardBody>
                        <CardNav href={`/admin/people/${person.id}`} label={t('openPersonDossier')}>
                          <PersonCardRow>
                            <Avatar name={fullName} size={40} />
                            <PersonCardMeta>
                              <Text variant="subtitle">{fullName}</Text>
                              {person.phone && (
                                <Text variant="caption" muted dir="ltr">
                                  {person.phone}
                                </Text>
                              )}
                              <PeopleCardChips>
                                {!mentorView && (
                                  <Chip>{t(person.orgLevel as TextKey)}</Chip>
                                )}
                                <Chip tone={person.verified ? 'success' : 'warning'}>
                                  {t(person.verified ? 'verified' : 'unverified')}
                                </Chip>
                              </PeopleCardChips>
                            </PersonCardMeta>
                          </PersonCardRow>
                        </CardNav>
                        <PeopleCardActions>
                          {person.capabilities.update && (
                            <IconAction
                              label={t('edit')}
                              icon="solar:pen-bold"
                              onClick={() => setEditing(person)}
                            />
                          )}
                          {person.capabilities.linkParent && (
                            <IconAction
                              label={t('parentLink')}
                              icon="solar:users-group-rounded-bold"
                              onClick={() => setParentChild(person)}
                            />
                          )}
                          {person.capabilities.verify && !person.verified && (
                            <IconAction
                              label={t('verify')}
                              icon="solar:verified-check-bold"
                              color="primary"
                              onClick={() => verify.mutate(person.id)}
                            />
                          )}
                          {person.capabilities.deactivate && (
                            <IconAction
                              label={t('deactivate')}
                              icon="solar:user-block-bold"
                              color="error"
                              onClick={() => setDeleting(person)}
                            />
                          )}
                          {me.capabilities.manageSettings && (
                            <IconAction
                              label={t('account')}
                              icon="solar:lock-password-outline"
                              onClick={() => setAccount(person)}
                            />
                          )}
                        </PeopleCardActions>
                      </PeopleCardBody>
                    </PeoplePersonCard>
                  );
                })}
              </PeopleCardsGrid>
            </Stack>
          </QueryState>
          {query.data && query.data.total > 15 && (
            <Pagination
              page={page}
              total={query.data.total}
              limit={15}
              onChange={setPage}
              hideTotal
            />
          )}
        </>
      ) : !managedGroup ? (
        <Card>
          <EmptyState title={t('coachingTeam')} hint={t('noManagedGroup')} />
        </Card>
      ) : (
        <>
          {sendInvite.feedback}
          <QueryState
            loading={invites.isLoading || groups.isLoading}
            error={invites.error}
            retry={() => void invites.refetch()}
          >
            {(invites.data?.items.length ?? 0) === 0 ? (
              <Card>
                <EmptyState title={t('coachingTeam')} hint={t('coachingTeamHint')} />
              </Card>
            ) : (
              <Stack>
                <Grid>
                  {(invites.data?.items ?? []).map((invite) => (
                    <Card key={invite.id}>
                      <PersonCardRow>
                        <Avatar name={invite.inviteeName} size={40} />
                        <PersonCardMeta>
                          <Text variant="subtitle">{invite.inviteeName}</Text>
                          <Chip tone={inviteStatusTone(invite.status)}>
                            {t(inviteStatusKey(invite.status))}
                          </Chip>
                        </PersonCardMeta>
                      </PersonCardRow>
                    </Card>
                  ))}
                </Grid>
              </Stack>
            )}
          </QueryState>
        </>
      )}
      <Dialog
        open={inviting}
        title={t('inviteAssistant')}
        onClose={() => setInviting(false)}
        actions={
          <>
            <Button variant="text" onClick={() => setInviting(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!inviteeId || sendInvite.isPending}
              onClick={() => sendInvite.mutate(undefined)}
            >
              {t('sendInvite')}
            </Button>
          </>
        }
      >
        <Stack>
          <Text muted>{t('inviteAssistantHint')}</Text>
          <PersonPicker
            label="pickInvitee"
            value={inviteeId}
            onChange={setInviteeId}
            onSearch={setCandidateSearch}
            loading={candidates.isLoading}
            error={!!candidates.error}
            options={(candidates.data?.items ?? []).map((person) => ({
              value: person.id,
              label: `${person.firstName} ${person.lastName}`,
            }))}
          />
          {sendInvite.feedback}
        </Stack>
      </Dialog>
      <Dialog
        open={editing !== undefined}
        title={t(editing ? 'edit' : 'create')}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <PersonForm
            key={editing?.id ?? 'new'}
            person={editing ?? undefined}
            groups={groups.data?.items ?? []}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        title={t('deactivate')}
        onClose={() => setDeleting(undefined)}
        actions={
          <>
            <Button variant="text" onClick={() => setDeleting(undefined)}>
              {t('cancel')}
            </Button>
            <Button
              color="error"
              disabled={deactivate.isPending}
              onClick={() => deactivate.mutate(undefined)}
            >
              {t('confirm')}
            </Button>
          </>
        }
      >
        <Text>{t('deactivateHint')}</Text>
        {deactivate.feedback}
      </Dialog>
      <Dialog
        open={!!parentChild}
        title={t('parentLink')}
        onClose={() => setParentChild(undefined)}
      >
        <BasicForm
          fields={[{ key: 'parentPhone', label: 'parentPhone', type: 'tel' }]}
          onSubmit={parentLink.mutate}
          busy={parentLink.isPending}
        />
        {parentLink.feedback}
      </Dialog>
      <Dialog open={!!account} title={t('account')} onClose={() => setAccount(undefined)}>
        <BasicForm
          fields={[{ key: 'password', label: 'newPassword', type: 'password' }]}
          onSubmit={provision.mutate}
          busy={provision.isPending}
        />
        {provision.feedback}
      </Dialog>
    </Permission>
  );
}
export function GroupsScreen() {
  const t = useFa();
  const me = useSession();
  const [groupId, setGroupId] = useState('');
  const [creating, setCreating] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [ownerId, setOwnerId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [transferPerson, setTransferPerson] = useState('');
  const [transferGroup, setTransferGroup] = useState('');
  const [membershipRole, setMembershipRole] = useState<'member' | 'assistant'>('member');
  const query = useQuery({ queryKey: ['groups'], queryFn: () => api.groups() });
  const current = query.data?.items.find((group) => group.id === groupId);
  const members = useQuery({
    queryKey: ['members', groupId, memberPage],
    enabled: !!current?.canManage,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/members', {
          params: { path: { id: groupId }, query: { page: memberPage, limit: 100 } },
        })
      ),
  });
  const assign = useWrite(async () =>
    unwrap(
      await client.POST('/api/v1/groups/{id}/assignments', {
        params: { path: { id: groupId } },
        body: { memberPersonId: memberId, assistantPersonId: assistantId || undefined },
      })
    )
  );
  const create = useWrite(
    async () =>
      unwrap(
        await client.POST('/api/v1/groups', {
          body: { name: groupName, ownerPersonId: ownerId },
        })
      ),
    () => setCreating(false)
  );
  const transfer = useWrite(async () =>
    unwrap(
      await client.POST('/api/v1/groups/{id}/memberships', {
        params: { path: { id: transferGroup } },
        body: { personId: transferPerson, role: membershipRole },
      })
    )
  );
  return (
    <Permission allowed={me.capabilities.manageGroups || me.capabilities.managePeople}>
      <PageHeader
        title={t('groups')}
        hint={t('groupsHint')}
        action={
          me.capabilities.createGroups ? (
            <Button onClick={() => setCreating(true)} icon="add">
              {t('create')}
            </Button>
          ) : undefined
        }
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
      >
        <Grid>
          {query.data?.items.map((group) => (
            <Card key={group.id}>
              <Section>
                <Row>
                  <Text variant="subtitle">{group.name}</Text>
                  <Chip>
                    {formatNumber(group.memberCount)} {t('people')}
                  </Chip>
                </Row>
                <Text muted>{group.ownerName}</Text>
                {group.canManage && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setGroupId(group.id);
                      setMemberPage(1);
                    }}
                  >
                    {t('members')}
                  </Button>
                )}
              </Section>
            </Card>
          ))}
        </Grid>
      </QueryState>
      {current && (
        <>
          <PageHeader title={current.name} hint={t('members')} />
          <QueryState
            loading={members.isLoading}
            error={members.error}
            empty={members.data?.items.length === 0}
            retry={() => void members.refetch()}
          >
            <DataTable
              rows={members.data?.items ?? []}
              rowKey={(row) => `${row.id}-${row.role}`}
              columns={[
                { label: t('name'), render: (row) => row.name },
                { label: t('orgLevel'), render: (row) => t(row.role as TextKey) },
                {
                  label: t('assistantPersonId'),
                  render: (row) => row.assistantName || t('noAssistant'),
                },
              ]}
            />
          </QueryState>
          {members.data && (
            <Pagination
              page={memberPage}
              limit={100}
              total={members.data.total}
              onChange={setMemberPage}
            />
          )}
          <Card>
            <Section>
              <Text variant="subtitle">{t('assign')}</Text>
              <Select
                label={t('memberPersonId')}
                value={memberId}
                onChange={setMemberId}
                options={(members.data?.items ?? [])
                  .filter((row) => row.role === 'member')
                  .map((row) => ({ value: row.id, label: row.name }))}
              />
              <Select
                label={t('assistantPersonId')}
                value={assistantId}
                onChange={setAssistantId}
                options={[
                  { value: '', label: t('noAssistant') },
                  ...(members.data?.items ?? [])
                    .filter((row) => row.role === 'assistant')
                    .map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
              {assign.feedback}
              <Button
                disabled={!memberId || assign.isPending}
                onClick={() => assign.mutate(undefined)}
              >
                {t('assign')}
              </Button>
            </Section>
          </Card>
          <Card>
            <Section>
              <Text variant="subtitle">{t('transfer')}</Text>
              <Select
                label={t('orgLevel')}
                value={membershipRole}
                onChange={(value) => setMembershipRole(value as typeof membershipRole)}
                options={['member', 'assistant'].map((value) => ({
                  value,
                  label: codeText(value),
                }))}
              />
              <PersonPicker value={transferPerson} onChange={setTransferPerson} />
              <Select
                label={t('group')}
                value={transferGroup}
                onChange={setTransferGroup}
                options={(query.data?.items ?? [])
                  .filter((group) => group.canManage)
                  .map((group) => ({ value: group.id, label: group.name }))}
              />
              <Button
                disabled={!transferPerson || !transferGroup || transfer.isPending}
                onClick={() => transfer.mutate(undefined)}
              >
                {t('save')}
              </Button>
              {transfer.feedback}
            </Section>
          </Card>
        </>
      )}
      <Dialog open={creating} title={t('create')} onClose={() => setCreating(false)}>
        <Input
          label={t('name')}
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
        />
        <PersonPicker ownerOnly value={ownerId} onChange={setOwnerId} />
        <Button
          disabled={groupName.trim().length < 2 || !ownerId || create.isPending}
          onClick={() => create.mutate(undefined)}
        >
          {t('save')}
        </Button>
        {create.feedback}
      </Dialog>
    </Permission>
  );
}
export function ImportsScreen() {
  const t = useFa();
  const me = useSession();
  const [groupId, setGroupId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [rowPage, setRowPage] = useState(1);
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api.groups() });
  const jobs = useQuery({
    queryKey: ['imports', page],
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/imports', { params: { query: { page, limit: 15 } } })),
    refetchInterval: 5000,
  });
  const job = useQuery({
    queryKey: ['import', selected],
    enabled: !!selected,
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/imports/{id}', { params: { path: { id: selected } } })),
    refetchInterval: (query) =>
      ['queued', 'validating', 'committing'].includes(query.state.data?.status ?? '')
        ? 1500
        : false,
  });
  const rows = useQuery({
    queryKey: ['importRows', selected, rowPage, job.data?.status],
    enabled: !!selected && !['queued', 'validating'].includes(job.data?.status ?? 'queued'),
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/imports/{id}/rows', {
          params: { path: { id: selected }, query: { page: rowPage, limit: 15 } },
        })
      ),
  });
  const upload = useWrite(async () => {
    const data = new FormData();
    data.append('groupId', groupId);
    data.append('file', file!);
    const result = unwrap(
      await client.POST('/api/v1/imports', {
        body: data as unknown as { groupId: string; file: string },
        bodySerializer: (body) => body as unknown as FormData,
      })
    );
    setSelected(result.id);
    return result;
  });
  const confirm = useWrite(async () =>
    unwrap(
      await client.POST('/api/v1/imports/{id}/confirm', { params: { path: { id: selected } } })
    )
  );
  const label = (status: string) => t((status === 'invalid' ? 'invalidStatus' : status) as TextKey);
  return (
    <Permission allowed={me.capabilities.importPeople}>
      <PageHeader title={t('imports')} hint={t('importsHint')} />
      <Card>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate(undefined);
          }}
        >
          <Select
            label={t('group')}
            value={groupId}
            onChange={setGroupId}
            options={(groups.data?.items ?? [])
              .filter((group) => group.canManage)
              .map((group) => ({ value: group.id, label: group.name }))}
          />
          <FileInput onChange={setFile} />
          <Text variant="caption" muted>
            {t('importFormat')}
          </Text>
          {upload.feedback}
          <Button type="submit" disabled={!file || !groupId || upload.isPending}>
            {t('upload')}
          </Button>
        </Form>
      </Card>
      <QueryState
        loading={jobs.isLoading}
        error={jobs.error}
        empty={jobs.data?.items.length === 0}
        retry={() => void jobs.refetch()}
      >
        <DataTable
          rows={jobs.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { label: t('at'), render: (row) => formatDate(row.createdAt, true) },
            { label: t('status'), render: (row) => <Chip>{label(row.status)}</Chip> },
            { label: t('rowCount'), render: (row) => formatNumber(row.rowCount) },
            {
              label: t('actions'),
              render: (row) => (
                <Button
                  variant="text"
                  onClick={() => {
                    setSelected(row.id);
                    setRowPage(1);
                  }}
                >
                  {t('preview')}
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      {jobs.data && (
        <Pagination page={page} limit={15} total={jobs.data.total} onChange={setPage} />
      )}
      <Dialog open={!!selected} title={t('preview')} onClose={() => setSelected('')}>
        <QueryState loading={job.isLoading} error={job.error} retry={() => void job.refetch()}>
          {job.data && (
            <>
              <Row>
                <Chip>{label(job.data.status)}</Chip>
                <Text>
                  {t('validCount')}: {formatNumber(job.data.validCount)}
                </Text>
                <Text>
                  {t('errorCount')}: {formatNumber(job.data.errorCount)}
                </Text>
              </Row>
              <QueryState
                loading={rows.isLoading}
                error={rows.error}
                empty={rows.data?.items.length === 0}
                retry={() => void rows.refetch()}
              >
                <DataTable
                  rows={rows.data?.items ?? []}
                  rowKey={(row) => String(row.rowNumber)}
                  columns={[
                    { label: t('rowNumber'), render: (row) => formatNumber(row.rowNumber) },
                    { label: t('name'), render: (row) => row.name },
                    { label: t('nationalIdMasked'), render: (row) => row.nationalIdMasked },
                    { label: t('errors'), render: (row) => row.errors.join('، ') },
                  ]}
                />
              </QueryState>
              {rows.data && (
                <Pagination
                  page={rowPage}
                  limit={15}
                  total={rows.data.total}
                  onChange={setRowPage}
                />
              )}
              <Button
                disabled={!job.data.canConfirm || confirm.isPending}
                onClick={() => confirm.mutate(undefined)}
              >
                {t('confirmImport')}
              </Button>
              {confirm.feedback}
            </>
          )}
        </QueryState>
      </Dialog>
    </Permission>
  );
}
export function AccessScreen() {
  const me = useSession();
  const t = useFa();
  const [tab, setTab] = useState('grants');
  const [page, setPage] = useState(1);

  const policies = useQuery({
    queryKey: ['policies', page],
    enabled: me.capabilities.viewPolicies && tab === 'policies',
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/access/policies', { params: { query: { page, limit: 15 } } })
      ),
  });
  const grants = useQuery({
    queryKey: ['grants', page],
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/access/grants', { params: { query: { page, limit: 15 } } })),
  });
  const revoke = useWrite(async (id: string) =>
    unwrap(await client.POST('/api/v1/access/grants/{id}/revoke', { params: { path: { id } } }))
  );
  return (
    <>
      <PageHeader title={t('access')} hint={t('policiesHint')} />
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        items={[
          { value: 'grants', label: t('grants') },
          ...(me.capabilities.viewPolicies ? [{ value: 'policies', label: t('policies') }] : []),
        ]}
      />
      {tab === 'policies' ? (
        <QueryState
          loading={policies.isLoading}
          error={policies.error}
          empty={policies.data?.items.length === 0}
          retry={() => void policies.refetch()}
        >
          <DataTable
            rows={policies.data?.items ?? []}
            rowKey={(row) =>
              `${row.resourceType}-${row.action}-${row.ownerRole}-${row.viewerRelation}`
            }
            columns={(
              ['resourceType', 'action', 'ownerRole', 'viewerRelation', 'level'] as const
            ).map((key) => ({
              label: t(key),
              render: (row: components['schemas']['PolicyDto']) => codeText(row[key]),
            }))}
          />
          {policies.data && (
            <Pagination page={page} limit={15} total={policies.data.total} onChange={setPage} />
          )}
        </QueryState>
      ) : (
        <QueryState
          loading={grants.isLoading}
          error={grants.error}
          empty={grants.data?.items.length === 0}
          retry={() => void grants.refetch()}
        >
          <DataTable
            rows={grants.data?.items ?? []}
            rowKey={(row) => row.id}
            columns={[
              { label: t('resourceType'), render: (row) => codeText(row.resourceType) },
              { label: t('grantedAt'), render: (row) => formatDate(row.grantedAt, true) },
              {
                label: t('status'),
                render: (row) => <Chip>{t(row.revokedAt ? 'revoked' : 'active')}</Chip>,
              },
              {
                label: t('actions'),
                render: (row) =>
                  row.canRevoke && (
                    <Button variant="text" color="error" onClick={() => revoke.mutate(row.id)}>
                      {t('revoke')}
                    </Button>
                  ),
              },
            ]}
          />
          {grants.data && (
            <Pagination page={page} limit={15} total={grants.data.total} onChange={setPage} />
          )}
        </QueryState>
      )}
      {revoke.feedback}
    </>
  );
}
export function AuditScreen() {
  const t = useFa();
  const me = useSession();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['audit', page],
    enabled: me.capabilities.viewAudit,
    queryFn: async () =>
      unwrap(await client.GET('/api/v1/admin/audit', { params: { query: { page, limit: 15 } } })),
  });
  return (
    <Permission allowed={me.capabilities.viewAudit}>
      <PageHeader title={t('audit')} hint={t('auditHint')} />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
      >
        <DataTable
          rows={query.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { label: t('at'), render: (row) => formatDate(row.at, true) },
            { label: t('action'), render: (row) => codeText(row.action) },
            { label: t('resourceType'), render: (row) => codeText(row.resourceType) },
            {
              label: t('actorId'),
              render: (row) =>
                row.actorName?.trim() ||
                (row.actorId ? row.actorId.slice(0, 8) : '—'),
            },
          ]}
        />
      </QueryState>
      {query.data && (
        <Pagination page={page} limit={15} total={query.data.total} onChange={setPage} />
      )}
    </Permission>
  );
}
