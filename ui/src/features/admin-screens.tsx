'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Button,
  Dialog,
  Notice,
  Search,
  Select,
  Section,
  StatCard,
  DataTable,
  FileInput,
  PageHeader,
  Pagination,
  QueryState,
} from 'src/components/ui';

import { useSession } from './session';
import { PersonForm } from './member-screens';
import { PersonPicker } from './person-picker';
import { useWrite, BasicForm, Permission } from './shared';

type Person = components['schemas']['PersonDto'];
export function OverviewScreen() {
  const t = useFa();
  const query = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  return (
    <>
      <PageHeader title={t('overview')} hint={t('overviewHint')} />
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {query.data && (
          <>
            <Grid>
              {(
                [
                  'peopleCount',
                  'groupCount',
                  'assistantCount',
                  'consentPending',
                  'importPending',
                  'unreadCount',
                ] as const
              ).map((key) => (
                <StatCard
                  key={key}
                  title={t(key === 'consentPending' ? 'consentPendingCount' : key)}
                  value={query.data![key]}
                />
              ))}
            </Grid>
            {!query.data.organizationReady && (
              <Notice tone="warning">{t('organizationPending')}</Notice>
            )}
            <Card>
              <Row>
                <Text variant="subtitle">{t('private')}</Text>
                <Text muted>{t('privacyHint')}</Text>
              </Row>
            </Card>
          </>
        )}
      </QueryState>
    </>
  );
}
export function PeopleScreen() {
  const t = useFa();
  const me = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Person>();
  const [account, setAccount] = useState<Person>();
  const [parentChild, setParentChild] = useState<Person>();
  const query = useQuery({
    queryKey: ['people', page, search],
    queryFn: () => api.people(page, search),
  });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api.groups() });
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
  return (
    <Permission allowed={me.capabilities.managePeople}>
      <PageHeader
        title={t('people')}
        hint={t('peopleHint')}
        action={
          <Button icon="add" onClick={() => setEditing(null)}>
            {t('create')}
          </Button>
        }
      />
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
        empty={query.data?.items.length === 0}
        retry={() => void query.refetch()}
      >
        <DataTable
          rows={query.data?.items ?? []}
          rowKey={(person) => person.id}
          columns={[
            {
              label: t('name'),
              render: (p) => (
                <Stack>
                  <Text>
                    {p.firstName} {p.lastName}
                  </Text>
                  <Text variant="caption" muted>
                    {p.groupName}
                  </Text>
                </Stack>
              ),
            },
            { label: t('orgLevel'), render: (p) => <Chip>{t(p.orgLevel as TextKey)}</Chip> },
            {
              label: t('status'),
              render: (p) => (
                <Chip tone={p.verified ? 'success' : 'warning'}>
                  {t(p.verified ? 'verified' : 'unverified')}
                </Chip>
              ),
            },
            {
              label: t('actions'),
              render: (p) => (
                <Row>
                  {p.capabilities.update && (
                    <Button variant="text" onClick={() => setEditing(p)}>
                      {t('edit')}
                    </Button>
                  )}
                  {p.capabilities.linkParent && (
                    <Button variant="text" onClick={() => setParentChild(p)}>
                      {t('parentLink')}
                    </Button>
                  )}
                  {p.capabilities.verify && !p.verified && (
                    <Button variant="text" onClick={() => verify.mutate(p.id)}>
                      {t('verify')}
                    </Button>
                  )}
                  {p.capabilities.deactivate && (
                    <Button color="error" variant="text" onClick={() => setDeleting(p)}>
                      {t('deactivate')}
                    </Button>
                  )}
                  {me.capabilities.manageSettings && (
                    <Button variant="text" onClick={() => setAccount(p)}>
                      {t('account')}
                    </Button>
                  )}
                </Row>
              ),
            },
          ]}
        />
      </QueryState>
      {query.data && (
        <Pagination page={page} total={query.data.total} limit={15} onChange={setPage} />
      )}
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
            { label: t('actorId'), render: (row) => row.actorId?.slice(0, 8) },
          ]}
        />
      </QueryState>
      {query.data && (
        <Pagination page={page} limit={15} total={query.data.total} onChange={setPage} />
      )}
    </Permission>
  );
}
