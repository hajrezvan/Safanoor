'use client';

import type { components } from 'src/api/generated/schema';

import { z } from 'zod';
import { useRef, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber, studyPathSchema, studyPathItemSchema } from '@safanoor/shared';

import { useWrite } from 'src/features/shared';
import { useFa } from 'src/locales/fa-provider';
import { api, client, unwrap } from 'src/api/client';
import { Session, useSession } from 'src/features/session';

import {
  Row,
  Chip,
  Form,
  Icon,
  Text,
  Input,
  Stack,
  Button,
  Dialog,
  Select,
  CardsGrid,
  CoverCard,
  EmptyState,
  IconAction,
  PageHeader,
  QueryState,
  BookCardBody,
  PathSequence,
  CoverCardBody,
  IconActionRow,
  BookCoverThumb,
  CoverCardMedia,
  BookCardActions,
  BookCoverButton,
  CoverCardAction,
  ReadingProgress,
  PathSequenceCard,
  PathSequenceNode,
  PathSequenceStep,
  BookCoverPlaceholder,
  CoverCardMediaPlaceholder,
} from 'src/components/ui';

type StudyPathSummary = components['schemas']['StudyPathSummaryDto'];
type StudyPathItem = components['schemas']['StudyPathItemDto'];

function useLibraryGroup() {
  const me = useSession();
  const orgWide = me.activeRole?.kind === 'technical_manager';
  const groups = useQuery({
    queryKey: ['groups', 'library'],
    queryFn: () => api.groups(),
    enabled: !orgWide,
  });
  const resolved = useMemo(() => {
    if (orgWide) return { groupId: null as string | null, canManage: false, orgWide: true };
    const managed = groups.data?.items.find((group) => group.canManage);
    if (managed) return { groupId: managed.id, canManage: true, orgWide: false };
    if (me.person.groupId)
      return { groupId: me.person.groupId, canManage: false, orgWide: false };
    return { groupId: null as string | null, canManage: false, orgWide: false };
  }, [groups.data, me.person.groupId, orgWide]);
  return {
    ...resolved,
    loading: orgWide ? false : groups.isLoading,
    error: orgWide ? null : groups.error,
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

function BookStepCard({
  item,
  index,
  total,
  canManage,
  canTrackReading,
  busyReading,
  onReading,
  busyReorder,
  busyRemove,
  onMove,
  onRemove,
  onCover,
  onPdfUpload,
  onPdfRemove,
}: {
  item: StudyPathItem;
  index: number;
  total: number;
  canManage: boolean;
  canTrackReading: boolean;
  busyReading: boolean;
  onReading: (status: StudyPathItem['readingStatus']) => void;
  busyReorder: boolean;
  busyRemove: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onCover: (file: File) => void;
  onPdfUpload: (file: File) => void;
  onPdfRemove: () => void;
}) {
  const t = useFa();
  const coverInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  return (
    <PathSequenceStep>
      <PathSequenceNode>{formatNumber(index + 1)}</PathSequenceNode>
      <PathSequenceCard>
        <BookCoverButton
          type="button"
          disabled={!canManage}
          aria-label={t('bookCoverUpload')}
          onClick={() => {
            if (canManage) coverInput.current?.click();
          }}
        >
          {item.coverUrl ? (
            <BookCoverThumb src={item.coverUrl} alt={t('bookCover')} />
          ) : (
            <BookCoverPlaceholder>
              <Icon name="library" />
            </BookCoverPlaceholder>
          )}
        </BookCoverButton>
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label={t('bookCoverUpload')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onCover(file);
            event.target.value = '';
          }}
        />
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf"
          hidden
          aria-label={t('bookPdfUpload')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPdfUpload(file);
            event.target.value = '';
          }}
        />
        <BookCardBody>
          <Text variant="subtitle">{item.bookTitle}</Text>
          {item.bookAuthor ? <Text muted>{item.bookAuthor}</Text> : null}
          {item.notes ? (
            <Text muted variant="caption">
              {item.notes}
            </Text>
          ) : null}
          {canTrackReading && (
            <Select
              label={t('readingStatus')}
              value={item.readingStatus}
              disabled={busyReading}
              onChange={(value) => onReading(value as StudyPathItem['readingStatus'])}
              options={[
                { value: 'not_started', label: t('readingNotStarted') },
                { value: 'reading', label: t('readingStarted') },
                { value: 'completed', label: t('readingCompleted') },
              ]}
            />
          )}
          <BookCardActions>
            <IconActionRow>
              <IconAction
                label={item.pdfUrl ? t('bookPdfOpen') : t('bookPdfMissing')}
                icon="solar:document-text-bold"
                disabled={!item.pdfUrl}
                onClick={() => {
                  if (item.pdfUrl)
                    window.open(item.pdfUrl, '_blank', 'noopener,noreferrer');
                }}
              />
              {canManage ? (
                <>
                  <IconAction
                    label={t('bookPdfUpload')}
                    icon="solar:upload-minimalistic-bold"
                    onClick={() => pdfInput.current?.click()}
                  />
                  <IconAction
                    label={t('bookPdfDelete')}
                    icon="solar:trash-bin-minimalistic-bold"
                    color="error"
                    disabled={!item.pdfUrl}
                    onClick={onPdfRemove}
                  />
                </>
              ) : null}
            </IconActionRow>
            {canManage ? (
              <IconActionRow>
                <IconAction
                  label={t('moveUp')}
                  icon="solar:arrow-up-bold"
                  disabled={index === 0 || busyReorder}
                  onClick={() => onMove(-1)}
                />
                <IconAction
                  label={t('moveDown')}
                  icon="solar:arrow-down-bold"
                  disabled={index === total - 1 || busyReorder}
                  onClick={() => onMove(1)}
                />
                <IconAction
                  label={t('deleteBook')}
                  icon="solar:trash-bin-trash-bold"
                  color="error"
                  disabled={busyRemove}
                  onClick={onRemove}
                />
              </IconActionRow>
            ) : null}
          </BookCardActions>
        </BookCardBody>
      </PathSequenceCard>
    </PathSequenceStep>
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
  const reading = useWrite(
    async ({ itemId, status }: { itemId: string; status: StudyPathItem['readingStatus'] }) =>
      unwrap(await client.PATCH('/api/v1/study-paths/{id}/items/{itemId}/reading', {
        params: { path: { id: pathId, itemId } }, body: { status },
      })),
    invalidate,
  );
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
  const uploadCover = useWrite(
    async (input: { itemId: string; file: File }) => {
      const data = new FormData();
      data.append('file', input.file);
      return unwrap(
        await client.POST('/api/v1/study-paths/{id}/items/{itemId}/cover', {
          params: { path: { id: pathId, itemId: input.itemId } },
          body: data as unknown as { file: string },
          bodySerializer: (body) => body as unknown as FormData,
        })
      );
    },
    invalidate
  );
  const uploadPdf = useWrite(
    async (input: { itemId: string; file: File }) => {
      const data = new FormData();
      data.append('file', input.file);
      return unwrap(
        await client.POST('/api/v1/study-paths/{id}/items/{itemId}/pdf', {
          params: { path: { id: pathId, itemId: input.itemId } },
          body: data as unknown as { file: string },
          bodySerializer: (body) => body as unknown as FormData,
        })
      );
    },
    invalidate
  );
  const removePdf = useWrite(
    async (itemId: string) =>
      unwrap(
        await client.DELETE('/api/v1/study-paths/{id}/items/{itemId}/pdf', {
          params: { path: { id: pathId, itemId } },
        })
      ),
    invalidate
  );
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
        compact
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
            {path.readingProgress?.started && (
              <ReadingProgress
                value={path.readingProgress.percent}
                label={t('readingProgress', {
                  percent: formatNumber(path.readingProgress.percent),
                  completed: formatNumber(path.readingProgress.completedCount),
                  total: formatNumber(path.readingProgress.totalCount),
                })}
              />
            )}
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
              <>
                <Text muted>{t('studyPathSequenceHint')}</Text>
                <PathSequence>
                  {path.items.map((item: StudyPathItem, index) => (
                    <BookStepCard
                      key={item.id}
                      item={item}
                      index={index}
                      total={path.items.length}
                      canManage={path.canManage}
                      canTrackReading={path.canTrackReading}
                      busyReading={reading.isPending}
                      onReading={(status) => reading.mutate({ itemId: item.id, status })}
                      busyReorder={reorder.isPending}
                      busyRemove={removeItem.isPending}
                      onMove={(delta) => move(index, delta)}
                      onRemove={() => removeItem.mutate(item.id)}
                      onCover={(file) =>
                        uploadCover.mutate({ itemId: item.id, file })
                      }
                      onPdfUpload={(file) =>
                        uploadPdf.mutate({ itemId: item.id, file })
                      }
                      onPdfRemove={() => removePdf.mutate(item.id)}
                    />
                  ))}
                </PathSequence>
              </>
            )}
            {reading.feedback}
            {addItem.feedback}
            {removeItem.feedback}
            {reorder.feedback}
            {removePath.feedback}
            {uploadCover.feedback}
            {uploadPdf.feedback}
            {removePdf.feedback}
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
  orgWide,
  onOpen,
}: {
  groupId: string | null;
  canManage: boolean;
  orgWide: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useFa();
  const [createOpen, setCreateOpen] = useState(false);
  const list = useQuery({
    queryKey: ['study-paths', orgWide ? 'all' : groupId],
    enabled: orgWide || !!groupId,
    queryFn: async () =>
      orgWide
        ? unwrap(
            await client.GET('/api/v1/study-paths', {
              params: { query: { page: 1, limit: 100 } },
            })
          )
        : unwrap(
            await client.GET('/api/v1/groups/{id}/study-paths', {
              params: { path: { id: groupId! }, query: { page: 1, limit: 50 } },
            })
          ),
  });
  const create = useWrite(
    async (body: z.infer<typeof studyPathSchema>) =>
      unwrap(
        await client.POST('/api/v1/groups/{id}/study-paths', {
          params: { path: { id: groupId! } },
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
        hint={orgWide ? t('libraryAllGroupsHint') : t('libraryHint')}
        action={
          canManage && !orgWide ? (
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
              canManage && !orgWide ? (
                <Button icon="add" onClick={() => setCreateOpen(true)}>
                  {t('createStudyPath')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <CardsGrid>
            {list.data?.items.map((path: StudyPathSummary) => (
              <CoverCard key={path.id}>
                {path.coverUrl ? (
                  <CoverCardMedia src={path.coverUrl} alt={path.title} />
                ) : (
                  <CoverCardMediaPlaceholder>
                    <Icon name="library" />
                  </CoverCardMediaPlaceholder>
                )}
                <CoverCardBody>
                  <Text variant="subtitle">{path.title}</Text>
                  {path.groupName ? (
                    <Text muted variant="caption">
                      {path.groupName}
                    </Text>
                  ) : null}
                  {path.description ? (
                    <Text muted>{path.description}</Text>
                  ) : null}
                  <CoverCardAction>
                    <Chip>{t('bookCount', { count: formatNumber(path.itemCount) })}</Chip>
                    <Button variant="outlined" onClick={() => onOpen(path.id)}>
                      {t('openStudyPath')}
                    </Button>
                  </CoverCardAction>
                </CoverCardBody>
              </CoverCard>
            ))}
          </CardsGrid>
        )}
      </QueryState>
      {create.feedback}
      {!orgWide && groupId ? (
        <CreatePathDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          busy={create.isPending}
          onSubmit={(values) => create.mutate(values)}
        />
      ) : null}
    </Stack>
  );
}

function LibraryScreen() {
  const t = useFa();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupId, canManage, orgWide, loading, error, refetch } = useLibraryGroup();
  return (
    <QueryState loading={loading} error={error} retry={() => void refetch()}>
      {!orgWide && !groupId ? (
        <Stack>
          <PageHeader title={t('library')} />
          <EmptyState title={t('noGroupForLibrary')} />
        </Stack>
      ) : selected ? (
        <PathDetail pathId={selected} onBack={() => setSelected(null)} />
      ) : (
        <PathList
          groupId={groupId}
          canManage={canManage}
          orgWide={orgWide}
          onOpen={setSelected}
        />
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
