'use client';

import type { components } from 'src/api/generated/schema';

import { useMemo, useState, type ReactNode } from 'react';
import { formatDate, formatNumber } from '@safanoor/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Chip,
  Text,
  Check,
  Input,
  Stack,
  Select,
  Button,
  Dialog,
  Notice,
  FileInput,
  PhotoGrid,
  PageHeader,
  PhotoThumb,
  QueryState,
  PhotoViewer,
  AutocompleteSelect,
} from 'src/components/ui';

import { useWrite } from './shared';
import { PersonPicker } from './person-picker';

type AlbumSummary = components['schemas']['AlbumSummaryDto'];
type PhotoSummary = components['schemas']['PhotoSummaryDto'];
type PhotoDetail = components['schemas']['PhotoDetailDto'];

const OTHER_ALBUM_KEY = '__other__';

export function AlbumScreen() {
  const t = useFa();
  const cache = useQueryClient();
  const [myOnly, setMyOnly] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'most_photos'>('newest');
  const [openAlbum, setOpenAlbum] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDraft, setAlbumDraft] = useState('');
  const [title, setTitle] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [placeDraft, setPlaceDraft] = useState('');
  const [placeSearch, setPlaceSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [tagLabels, setTagLabels] = useState<Record<string, string>>({});

  const groups = useQuery({
    queryKey: ['groups', 'album'],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups', {
          params: { query: { page: 1, limit: 100 } },
        })
      ),
  });
  const managedGroup = useMemo(
    () => groups.data?.items.find((group) => group.canManage),
    [groups.data]
  );
  const canUpload = !!managedGroup;

  const albums = useQuery({
    queryKey: ['album-albums', myOnly, sort],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/album/albums', {
          params: { query: { page: 1, limit: 100, myOnly, sort } },
        })
      ),
  });

  const photos = useQuery({
    queryKey: ['album-photos', openAlbum?.key, myOnly, sort],
    enabled: !!openAlbum,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/album/photos', {
          params: {
            query: {
              page: 1,
              limit: 100,
              myOnly,
              sort: sort === 'most_photos' ? 'newest' : sort,
              albumKey: openAlbum!.key,
            },
          },
        })
      ),
  });

  const detail = useQuery({
    queryKey: ['album-photo', selectedId],
    enabled: !!selectedId,
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/album/photos/{id}', {
          params: { path: { id: selectedId! } },
        })
      ),
  });

  const locations = useQuery({
    queryKey: ['locations', placeSearch],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/locations', {
          params: { query: { page: 1, limit: 50, search: placeSearch || undefined } },
        })
      ),
    enabled: uploading,
  });

  const upload = useWrite(async () => {
    if (!managedGroup || !file) throw new Error(t('required'));
    const resolvedAlbum = (albumTitle || albumDraft).trim();
    const data = new FormData();
    data.append('groupId', managedGroup.id);
    data.append('file', file);
    if (resolvedAlbum) data.append('albumTitle', resolvedAlbum);
    if (title.trim()) data.append('title', title.trim());
    if (eventNote.trim()) data.append('eventNote', eventNote.trim());
    if (placeId) data.append('locationOptionId', placeId);
    else if (placeDraft.trim()) data.append('place', placeDraft.trim());
    if (tagIds.length) data.append('taggedPersonIds', JSON.stringify(tagIds));
    const result = unwrap(
      await client.POST('/api/v1/album/photos', {
        params: { query: { groupId: managedGroup.id } },
        body: data as unknown as {
          groupId: string;
          file: string;
          albumTitle?: string;
          title?: string;
          eventNote?: string;
          locationOptionId?: string;
          place?: string;
          taggedPersonIds?: string;
        },
        bodySerializer: (body) => body as unknown as FormData,
      })
    );
    setUploading(false);
    setAlbumTitle('');
    setAlbumDraft('');
    setTitle('');
    setEventNote('');
    setPlaceId('');
    setPlaceDraft('');
    setPlaceSearch('');
    setFile(null);
    setTagIds([]);
    setTagDraft('');
    setTagLabels({});
    setSelectedId(result.id);
    if (resolvedAlbum) {
      setOpenAlbum({ key: resolvedAlbum, title: resolvedAlbum });
    } else {
      setOpenAlbum({ key: OTHER_ALBUM_KEY, title: t('otherAlbum') });
    }
    void cache.invalidateQueries({ queryKey: ['album-albums'] });
    void cache.invalidateQueries({ queryKey: ['album-photos'] });
    void cache.invalidateQueries({ queryKey: ['locations'] });
    return result;
  });

  const people = useQuery({
    queryKey: ['album-tag-people'],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/people', {
          params: { query: { page: 1, limit: 100 } },
        })
      ),
  });

  function addTag(personId: string) {
    if (!personId || tagIds.includes(personId)) return;
    const person = people.data?.items.find((item) => item.id === personId);
    const label = person ? `${person.firstName} ${person.lastName}` : personId;
    setTagIds((current) => [...current, personId]);
    setTagLabels((current) => ({ ...current, [personId]: label }));
    setTagDraft('');
  }

  function resetUpload() {
    setUploading(false);
    setPlaceId('');
    setPlaceDraft('');
    setPlaceSearch('');
  }

  function albumDisplayTitle(album: AlbumSummary): string {
    if (album.key === OTHER_ALBUM_KEY || !album.title) return t('otherAlbum');
    return album.title;
  }

  const filters = (
    <Row>
      <Check label={t('albumMyOnly')} checked={myOnly} onChange={setMyOnly} />
      <Select
        label={t('albumSort')}
        value={openAlbum && sort === 'most_photos' ? 'newest' : sort}
        onChange={(value) => setSort(value as typeof sort)}
        options={[
          { value: 'newest', label: t('albumNewest') },
          { value: 'oldest', label: t('albumOldest') },
          ...(!openAlbum ? [{ value: 'most_photos', label: t('albumMostPhotos') }] : []),
        ]}
      />
    </Row>
  );
  if (openAlbum) {
    return (
      <Stack>
        <PageHeader
          title={
            openAlbum.key === OTHER_ALBUM_KEY || !openAlbum.title
              ? t('otherAlbum')
              : openAlbum.title
          }
          hint={t('groupAlbumHint')}
          action={
            <Row>
              <Button
                variant="text"
                onClick={() => {
                  setOpenAlbum(null);
                  setSelectedId(undefined);
                }}
              >
                {t('backToAlbums')}
              </Button>
              {canUpload ? (
                <Button
                  icon="add"
                  onClick={() => {
                    setAlbumTitle(openAlbum.key === OTHER_ALBUM_KEY ? '' : openAlbum.title);
                    setAlbumDraft(openAlbum.key === OTHER_ALBUM_KEY ? '' : openAlbum.title);
                    setUploading(true);
                  }}
                >
                  {t('uploadPhoto')}
                </Button>
              ) : undefined}
            </Row>
          }
        />
        {filters}
        <QueryState
          loading={photos.isLoading}
          error={photos.error}
          empty={(photos.data?.items.length ?? 0) === 0}
          emptyTitle={t('albumPhotosEmpty')}
          emptyHint={t('albumPhotosEmptyHint')}
          retry={() => void photos.refetch()}
        >
          <PhotoGrid>
            {(photos.data?.items ?? []).map((photo: PhotoSummary) => (
              <PhotoThumb
                key={photo.id}
                src={photo.contentUrl}
                alt={photo.title || t('untitledPhoto')}
                title={photo.title || t('untitledPhoto')}
                subtitle={photo.hostGroupName}
                onClick={() => setSelectedId(photo.id)}
              />
            ))}
          </PhotoGrid>
        </QueryState>
        <UploadDialog
          open={uploading}
          canUpload={canUpload}
          managedGroupName={managedGroup?.name}
          albums={albums.data?.items ?? []}
          albumTitle={albumTitle}
          albumDraft={albumDraft}
          title={title}
          eventNote={eventNote}
          placeId={placeId}
          placeDraft={placeDraft}
          locations={locations.data?.items ?? []}
          locationsLoading={locations.isLoading}
          file={file}
          tagDraft={tagDraft}
          tagIds={tagIds}
          tagLabels={tagLabels}
          uploadPending={upload.isPending}
          uploadFeedback={upload.feedback}
          onClose={resetUpload}
          onSubmit={() => upload.mutate(undefined)}
          onAlbumTitleChange={setAlbumTitle}
          onAlbumDraftChange={setAlbumDraft}
          onTitleChange={setTitle}
          onEventNoteChange={setEventNote}
          onPlaceIdChange={setPlaceId}
          onPlaceDraftChange={setPlaceDraft}
          onPlaceSearchChange={setPlaceSearch}
          onFileChange={setFile}
          onAddTag={addTag}
          onRemoveTag={(id) => setTagIds((current) => current.filter((item) => item !== id))}
        />
        <PhotoDetailDialog
          selectedId={selectedId}
          detail={detail.data}
          loading={detail.isLoading}
          error={detail.error}
          onClose={() => {
            setSelectedId(undefined);
            void cache.invalidateQueries({
              queryKey: ['album-photos', openAlbum.key],
            });
          }}
          onRetry={() => void detail.refetch()}
        />
      </Stack>
    );
  }

  return (
    <Stack>
      <PageHeader
        title={t('groupAlbum')}
        hint={t('groupAlbumHint')}
        action={
          canUpload ? (
            <Button icon="add" onClick={() => setUploading(true)}>
              {t('uploadPhoto')}
            </Button>
          ) : undefined
        }
      />
      {filters}
      <QueryState
        loading={albums.isLoading || groups.isLoading}
        error={albums.error || groups.error}
        empty={(albums.data?.items.length ?? 0) === 0}
        emptyTitle={t('groupAlbumEmpty')}
        emptyHint={canUpload ? t('groupAlbumEmptyMentorHint') : t('groupAlbumEmptyHint')}
        retry={() => {
          void albums.refetch();
          void groups.refetch();
        }}
      >
        <PhotoGrid>
          {(albums.data?.items ?? []).map((album: AlbumSummary) => (
            <PhotoThumb
              key={album.key}
              src={album.coverContentUrl}
              alt={albumDisplayTitle(album)}
              title={albumDisplayTitle(album)}
              subtitle={t('albumPhotoCount', {
                count: formatNumber(album.photoCount),
              })}
              onClick={() =>
                setOpenAlbum({
                  key: album.key,
                  title: albumDisplayTitle(album),
                })
              }
            />
          ))}
        </PhotoGrid>
      </QueryState>

      <UploadDialog
        open={uploading}
        canUpload={canUpload}
        managedGroupName={managedGroup?.name}
        albums={albums.data?.items ?? []}
        albumTitle={albumTitle}
        albumDraft={albumDraft}
        title={title}
        eventNote={eventNote}
        placeId={placeId}
        placeDraft={placeDraft}
        locations={locations.data?.items ?? []}
        locationsLoading={locations.isLoading}
        file={file}
        tagDraft={tagDraft}
        tagIds={tagIds}
        tagLabels={tagLabels}
        uploadPending={upload.isPending}
        uploadFeedback={upload.feedback}
        onClose={resetUpload}
        onSubmit={() => upload.mutate(undefined)}
        onAlbumTitleChange={setAlbumTitle}
        onAlbumDraftChange={setAlbumDraft}
        onTitleChange={setTitle}
        onEventNoteChange={setEventNote}
        onPlaceIdChange={setPlaceId}
        onPlaceDraftChange={setPlaceDraft}
        onPlaceSearchChange={setPlaceSearch}
        onFileChange={setFile}
        onAddTag={addTag}
        onRemoveTag={(id) => setTagIds((current) => current.filter((item) => item !== id))}
      />

      <PhotoDetailDialog
        selectedId={selectedId}
        detail={detail.data}
        loading={detail.isLoading}
        error={detail.error}
        onClose={() => {
          setSelectedId(undefined);
          void cache.invalidateQueries({ queryKey: ['album-albums'] });
        }}
        onRetry={() => void detail.refetch()}
      />
    </Stack>
  );
}

function PhotoDetailDialog({
  selectedId,
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: {
  selectedId?: string;
  detail?: PhotoDetail;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onRetry: () => void;
}) {
  const t = useFa();
  return (
    <Dialog open={!!selectedId} title={detail?.title || t('photoDetail')} onClose={onClose}>
      <QueryState loading={loading} error={error} empty={!detail} retry={onRetry}>
        {detail && <PhotoDetailBody photo={detail} />}
      </QueryState>
    </Dialog>
  );
}

function PhotoDetailBody({ photo }: { photo: PhotoDetail }) {
  const t = useFa();
  return (
    <Stack>
      <PhotoViewer src={photo.contentUrl} alt={photo.title || t('untitledPhoto')} />
      {photo.albumTitle && (
        <Text muted>
          {t('photoAlbumTitle')}: {photo.albumTitle}
        </Text>
      )}
      {photo.eventNote && <Notice>{photo.eventNote}</Notice>}
      {photo.placeLabel && (
        <Text muted>
          {t('photoPlace')}: {photo.placeLabel}
        </Text>
      )}
      <Text muted>
        {photo.uploaderName} · {formatDate(photo.createdAt, true)} · {photo.hostGroupName}
      </Text>
      <Stack>
        <Text variant="subtitle">{t('photoTags')}</Text>
        {photo.tags.length === 0 ? (
          <Text muted>{t('photoTagsEmpty')}</Text>
        ) : (
          <Row>
            {photo.tags.map((tag) => (
              <Chip key={tag.personId}>
                {tag.firstName} {tag.lastName}
              </Chip>
            ))}
          </Row>
        )}
      </Stack>
      {photo.canManage && <Text muted>{t('photoManageHint')}</Text>}
    </Stack>
  );
}

function UploadDialog({
  open,
  canUpload,
  managedGroupName,
  albums,
  albumTitle,
  albumDraft,
  title,
  eventNote,
  placeId,
  placeDraft,
  locations,
  locationsLoading,
  file,
  tagDraft,
  tagIds,
  tagLabels,
  uploadPending,
  uploadFeedback,
  onClose,
  onSubmit,
  onAlbumTitleChange,
  onAlbumDraftChange,
  onTitleChange,
  onEventNoteChange,
  onPlaceIdChange,
  onPlaceDraftChange,
  onPlaceSearchChange,
  onFileChange,
  onAddTag,
  onRemoveTag,
}: {
  open: boolean;
  canUpload: boolean;
  managedGroupName?: string;
  albums: AlbumSummary[];
  albumTitle: string;
  albumDraft: string;
  title: string;
  eventNote: string;
  placeId: string;
  placeDraft: string;
  locations: { id: string; label: string }[];
  locationsLoading: boolean;
  file: File | null;
  tagDraft: string;
  tagIds: string[];
  tagLabels: Record<string, string>;
  uploadPending: boolean;
  uploadFeedback: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  onAlbumTitleChange: (value: string) => void;
  onAlbumDraftChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onEventNoteChange: (value: string) => void;
  onPlaceIdChange: (value: string) => void;
  onPlaceDraftChange: (value: string) => void;
  onPlaceSearchChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onAddTag: (personId: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const t = useFa();
  const albumOptions = albums
    .filter((album) => album.key !== OTHER_ALBUM_KEY && album.title)
    .map((album) => ({ value: album.key, label: album.title }));

  return (
    <Dialog
      open={open}
      title={t('uploadPhoto')}
      onClose={onClose}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={!file || !canUpload || uploadPending} onClick={onSubmit}>
            {t('uploadPhoto')}
          </Button>
        </>
      }
    >
      <Text muted>
        {managedGroupName
          ? t('uploadPhotoGroup', { name: managedGroupName })
          : t('noGroupForAlbum')}
      </Text>
      <FileInput
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={onFileChange}
      />
      <AutocompleteSelect
        label={t('photoAlbumTitle')}
        value={albumTitle}
        freeSolo
        limit={8}
        createLabel={(label) => t('photoAlbumTitleCreate', { label })}
        options={[
          ...(albumTitle && albumDraft && !albumOptions.some((o) => o.value === albumTitle)
            ? [{ value: albumTitle, label: albumDraft }]
            : []),
          ...albumOptions.filter((item) => item.value !== albumTitle),
        ]}
        onInputChange={(next) => {
          onAlbumDraftChange(next);
          if (albumTitle) {
            const selectedLabel =
              albumDraft || albumOptions.find((item) => item.value === albumTitle)?.label;
            if (selectedLabel && selectedLabel === next) return;
            onAlbumTitleChange('');
          }
        }}
        onChange={(next, option) => {
          if (!next) {
            onAlbumTitleChange('');
            onAlbumDraftChange('');
            return;
          }
          if (option?.inputValue || next.startsWith('__create__:')) {
            const label = option?.inputValue || option?.label || next.replace(/^__create__:/, '');
            onAlbumTitleChange('');
            onAlbumDraftChange(label);
            return;
          }
          const known = albumOptions.find((item) => item.value === next || item.label === next);
          if (known) {
            onAlbumTitleChange(known.value);
            onAlbumDraftChange(known.label);
            return;
          }
          onAlbumTitleChange('');
          onAlbumDraftChange(option?.label ?? next);
        }}
      />
      <Text muted variant="caption">
        {t('photoAlbumTitleHint')}
      </Text>
      <Input
        label={t('photoTitle')}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <Input
        label={t('photoEventNote')}
        value={eventNote}
        onChange={(event) => onEventNoteChange(event.target.value)}
        multiline
      />
      <AutocompleteSelect
        label={t('photoPlace')}
        value={placeId}
        freeSolo
        limit={8}
        createLabel={(label) => t('photoPlaceCreate', { label })}
        options={[
          ...(placeId && placeDraft ? [{ value: placeId, label: placeDraft }] : []),
          ...locations
            .filter((item) => item.id !== placeId)
            .map((item) => ({
              value: item.id,
              label: item.label,
            })),
        ]}
        loading={locationsLoading}
        onInputChange={(next) => {
          onPlaceSearchChange(next);
          if (placeId) {
            const selectedLabel =
              placeDraft || locations.find((item) => item.id === placeId)?.label;
            if (selectedLabel && selectedLabel === next) return;
            onPlaceIdChange('');
          }
          onPlaceDraftChange(next);
        }}
        onChange={(next, option) => {
          if (!next) {
            onPlaceIdChange('');
            onPlaceDraftChange('');
            return;
          }
          if (option?.inputValue || next.startsWith('__create__:')) {
            const label = option?.inputValue || option?.label || next.replace(/^__create__:/, '');
            onPlaceIdChange('');
            onPlaceDraftChange(label);
            return;
          }
          const known = locations.find((item) => item.id === next || item.label === next);
          if (known) {
            onPlaceIdChange(known.id);
            onPlaceDraftChange(known.label);
            return;
          }
          onPlaceIdChange('');
          onPlaceDraftChange(option?.label ?? next);
        }}
      />
      <Text muted variant="caption">
        {t('photoPlaceHint')}
      </Text>
      <Stack>
        <Text variant="caption">{t('photoTags')}</Text>
        <PersonPicker
          value={tagDraft}
          onChange={onAddTag}
          label="photoTagPerson"
          limit={5}
          showAvatar
          clearOnSelect
        />
        <Row>
          {tagIds.map((id) => (
            <Button key={id} variant="outlined" onClick={() => onRemoveTag(id)}>
              {`${tagLabels[id] ?? id} · ${t('removeTag')}`}
            </Button>
          ))}
        </Row>
      </Stack>
      {uploadFeedback}
    </Dialog>
  );
}
