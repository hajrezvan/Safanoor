'use client';

import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { studyPathItemSchema, studyPathSchema } from '@safanoor/shared';

import { api, client, unwrap } from 'src/api/client';
import { Session, useSession } from 'src/features/session';
import { useWrite } from 'src/features/shared';
import { useFa } from 'src/locales/fa-provider';
import {
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  Form,
  Input,
  Notice,
  PageHeader,
  QueryState,
  Row,
  Spread,
  Stack,
  Text,
} from 'src/components/ui';

type StudyPathSummary = components['schemas']['StudyPathSummaryDto'];

function useLibraryGroup() {
  const me = useSession();
  const groups = useQuery({
    queryKey: ['groups', 'library'],
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

function CreatePathDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof studyPathSchema>) => void;
  busy: boolean;
}) {
  const t = useFa();
  const form = useForm({
    resolver: zodResolver(studyPathSchema),
    defaultValues: { title: '', description: undefined },
  });
  return (
    <Dialog
      open={open}
      title={t('createStudyPath')}
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
            <Input {...field} label={t('studyPathTitle')} error={fieldState.error?.message} />
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              name={field.name}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              label={t('studyPathDescription')}
              multiline
              error={fieldState.error?.message}
            />
          )}
        />
      </Form>
    </Dialog>
  );
}

function AddBookDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof studyPathItemSchema>) => void;
  busy: boolean;
}) {
  const t = useFa();
  const form = useForm({
    resolver: zodResolver(studyPathItemSchema),
    defaultValues: { bookTitle: '', bookAuthor: undefined, notes: undefined },
  });
  return (
    <Dialog
      open={open}
      title={t('addBook')}
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
          name="bookTitle"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input {...field} label={t('bookTitle')} error={fieldState.error?.message} />
          )}
        />
        <Controller
          name="bookAuthor"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              name={field.name}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              label={t('bookAuthor')}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              name={field.name}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              label={t('bookNotes')}
              multiline
              error={fieldState.error?.message}
            />
          )}
        />
      </Form>
    </Dialog>
  );
}

function PathDetail({ pathId, onBack }: { pathId: string; onBack: () => void }) {
  const t = useFa();
  const cache = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const detail = useQuery({
    queryKey: ['study-path', pathId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/study-paths/{id}', {
          params: { path: { id: pathId } },
        })
      ),
  });
  const path = detail.data;
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ['study-path', pathId] });
    void cache.invalidateQueries({ queryKey: ['study-paths'] });
  };
  const addItem = useWrite(
    async (body: z.infer<typeof studyPathItemSchema>) =>
      unwrap(
        await client.POST('/api/v1/study-paths/{id}/items', {
          params: { path: { id: pathId } },
          body: {
            bookTitle: body.bookTitle,
            bookAuthor: body.bookAuthor,
            notes: body.notes,
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
        await client.DELETE('/api/v1/study-paths/{id}/items/{itemId}', {
          params: { path: { id: pathId, itemId } },
        })
      ),
    invalidate
  );
  const reorder = useWrite(
    async (itemIds: string[]) =>
      unwrap(
        await client.POST('/api/v1/study-paths/{id}/items/reorder', {
          params: { path: { id: pathId } },
          body: { itemIds },
        })
      ),
    invalidate
  );
  const removePath = useWrite(async (_: null) => {
    await unwrap(
      await client.DELETE('/api/v1/study-paths/{id}', {
        params: { path: { id: pathId } },
      })
    );
  }, onBack);
  const move = (index: number, delta: number) => {
    if (!path) return;
    const ids = path.items.map((item) => item.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    reorder.mutate(next);
  };
  return (
    <Stack>
      <PageHeader
        title={path?.title ?? t('studyPaths')}
        hint={path?.description || undefined}
        action={
          <Button variant="outlined" onClick={onBack} icon="back">
            {t('backToStudyPaths')}
          </Button>
        }
      />
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={() => void detail.refetch()}
      >
        {path && (
          <>
            {!path.canManage && <Notice tone="info">{t('studyPathViewOnly')}</Notice>}
            {path.canManage && (
              <Row>
                <Button icon="add" onClick={() => setAddOpen(true)}>
                  {t('addBook')}
                </Button>
                <Button color="error" variant="outlined" onClick={() => setConfirmDelete(true)}>
                  {t('deleteStudyPath')}
                </Button>
              </Row>
            )}
            {path.items.length === 0 ? (
              <EmptyState title={t('studyPathsEmpty')} hint={t('studyPathsEmptyHint')} />
            ) : (
              path.items.map((item, index) => (
                <Card key={item.id}>
                  <Stack>
                    <Spread>
                      <Stack>
                        <Text variant="subtitle">
                          {index + 1}. {item.bookTitle}
                        </Text>
                        {item.bookAuthor && <Text muted>{item.bookAuthor}</Text>}
                        {item.notes && <Text muted>{item.notes}</Text>}
                      </Stack>
                      <Chip>{index + 1}</Chip>
                    </Spread>
                    {path.canManage && (
                      <Row>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => move(index, -1)}
                        >
                          {t('moveUp')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={index === path.items.length - 1 || reorder.isPending}
                          onClick={() => move(index, 1)}
                        >
                          {t('moveDown')}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          disabled={removeItem.isPending}
                          onClick={() => removeItem.mutate(item.id)}
                        >
                          {t('deleteBook')}
                        </Button>
                      </Row>
                    )}
                  </Stack>
                </Card>
              ))
            )}
            {addItem.feedback}
            {removeItem.feedback}
            {reorder.feedback}
            {removePath.feedback}
          </>
        )}
      </QueryState>
      <AddBookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        busy={addItem.isPending}
        onSubmit={(values) => addItem.mutate(values)}
      />
      <Dialog
        open={confirmDelete}
        title={t('deleteStudyPath')}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmDelete(false)}>
              {t('cancel')}
            </Button>
            <Button
              color="error"
              disabled={removePath.isPending}
              onClick={() => removePath.mutate(null)}
            >
              {t(removePath.isPending ? 'busy' : 'confirm')}
            </Button>
          </>
        }
      >
        <Text>{t('deleteStudyPathHint')}</Text>
      </Dialog>
    </Stack>
  );
}

function PathList({
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
    queryKey: ['study-paths', groupId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/study-paths', {
          params: { path: { id: groupId }, query: { page: 1, limit: 50 } },
        })
      ),
  });
  const create = useWrite(
    async (body: z.infer<typeof studyPathSchema>) =>
      unwrap(
        await client.POST('/api/v1/groups/{id}/study-paths', {
          params: { path: { id: groupId } },
          body: { title: body.title, description: body.description },
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
        title={t('library')}
        hint={t('libraryHint')}
        action={
          canManage ? (
            <Button icon="add" onClick={() => setCreateOpen(true)}>
              {t('createStudyPath')}
            </Button>
          ) : undefined
        }
      />
      <QueryState loading={list.isLoading} error={list.error} retry={() => void list.refetch()}>
        {list.data && list.data.items.length === 0 ? (
          <EmptyState
            title={t('studyPathsEmpty')}
            hint={t('studyPathsEmptyHint')}
            action={
              canManage ? (
                <Button icon="add" onClick={() => setCreateOpen(true)}>
                  {t('createStudyPath')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          list.data?.items.map((path: StudyPathSummary) => (
            <Card key={path.id}>
              <Stack>
                <Spread>
                  <Stack>
                    <Text variant="subtitle">{path.title}</Text>
                    {path.description && <Text muted>{path.description}</Text>}
                  </Stack>
                  <Chip>{t('bookCount', { count: path.itemCount })}</Chip>
                </Spread>
                <Button variant="outlined" onClick={() => onOpen(path.id)}>
                  {t('openStudyPath')}
                </Button>
              </Stack>
            </Card>
          ))
        )}
      </QueryState>
      {create.feedback}
      <CreatePathDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        busy={create.isPending}
        onSubmit={(values) => create.mutate(values)}
      />
    </Stack>
  );
}

function LibraryScreen() {
  const t = useFa();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupId, canManage, loading, error, refetch } = useLibraryGroup();
  return (
    <QueryState loading={loading} error={error} retry={() => void refetch()}>
      {!groupId ? (
        <Stack>
          <PageHeader title={t('library')} />
          <EmptyState title={t('noGroupForLibrary')} />
        </Stack>
      ) : selected ? (
        <PathDetail pathId={selected} onBack={() => setSelected(null)} />
      ) : (
        <PathList groupId={groupId} canManage={canManage} onOpen={setSelected} />
      )}
    </QueryState>
  );
}

export default function Page() {
  return (
    <Session>
      <LibraryScreen />
    </Session>
  );
}
