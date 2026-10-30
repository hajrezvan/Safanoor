'use client';

import type { components } from 'src/api/generated/schema';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import {
  AutocompleteSelect,
  Button,
  Chip,
  Dialog,
  FileInput,
  Input,
  Notice,
  PageHeader,
  PhotoGrid,
  PhotoThumb,
  PhotoViewer,
  QueryState,
  Row,
  Stack,
  Text,
} from 'src/components/ui';

import { PersonPicker } from './person-picker';
import { useWrite } from './shared';

type PhotoSummary = components['schemas']['PhotoSummaryDto'];
type PhotoDetail = components['schemas']['PhotoDetailDto'];

export function AlbumScreen() {
  const t = useFa();
  const cache = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
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

  const photos = useQuery({
    queryKey: ['album-photos'],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/album/photos', {
          params: { query: { page: 1, limit: 100 } },
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
    const data = new FormData();
    data.append('groupId', managedGroup.id);
    data.append('file', file);
    if (title.trim()) data.append('title', title.trim());
    if (eventNote.trim()) data.append('eventNote', eventNote.trim());
    if (placeId) data.append('locationOptionId', placeId);
    else if (placeDraft.trim()) data.append('place', placeDraft.trim());
    if (tagIds.length) data.append('taggedPersonIds', JSON.stringify(tagIds));
    const result = unwrap(
      await client.POST('/api/v1/album/photos', {
        body: data as unknown as {
          groupId: string;
          file: string;
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
    const label = person
      ? `${person.firstName} ${person.lastName}`
      : personId;
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
      <QueryState
        loading={photos.isLoading || groups.isLoading}
        error={photos.error || groups.error}
        empty={(photos.data?.items.length ?? 0) === 0}
        emptyTitle={t('groupAlbumEmpty')}
        emptyHint={
          canUpload ? t('groupAlbumEmptyMentorHint') : t('groupAlbumEmptyHint')
        }
        retry={() => {
          void photos.refetch();
          void groups.refetch();
        }}
      >
        <PhotoGrid>
          {(photos.data?.items ?? []).map((photo: PhotoSummary) => (
            <PhotoThumb
              key={photo.id}
              src={photo.contentUrl}
              alt={photo.title || t('untitledPhoto')}
              title={photo.title || t('untitledPhoto')}
              subtitle={
                photo.tagCount
                  ? t('photoTagCount', { count: formatNumber(photo.tagCount) })
                  : photo.hostGroupName
              }
              onClick={() => setSelectedId(photo.id)}
            />
          ))}
        </PhotoGrid>
      </QueryState>

      <Dialog
        open={uploading}
        title={t('uploadPhoto')}
        onClose={resetUpload}
        actions={
          <>
            <Button variant="text" onClick={resetUpload}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!file || !managedGroup || upload.isPending}
              onClick={() => upload.mutate(undefined)}
            >
              {t('uploadPhoto')}
            </Button>
          </>
        }
      >
        <Text muted>
          {managedGroup
            ? t('uploadPhotoGroup', { name: managedGroup.name })
            : t('noGroupForAlbum')}
        </Text>
        <FileInput accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={setFile} />
        <Input label={t('photoTitle')} value={title} onChange={(event) => setTitle(event.target.value)} />
        <Input
          label={t('photoEventNote')}
          value={eventNote}
          onChange={(event) => setEventNote(event.target.value)}
          multiline
        />
        <AutocompleteSelect
          label={t('photoPlace')}
          value={placeId}
          freeSolo
          limit={8}
          createLabel={(label) => t('photoPlaceCreate', { label })}
          options={[
            ...(placeId && placeDraft
              ? [{ value: placeId, label: placeDraft }]
              : []),
            ...(locations.data?.items ?? [])
              .filter((item) => item.id !== placeId)
              .map((item) => ({
                value: item.id,
                label: item.label,
              })),
          ]}
          loading={locations.isLoading}
          onInputChange={(next) => {
            setPlaceSearch(next);
            if (placeId) {
              const selectedLabel =
                placeDraft ||
                locations.data?.items.find((item) => item.id === placeId)?.label;
              if (selectedLabel && selectedLabel === next) return;
              setPlaceId('');
            }
            setPlaceDraft(next);
          }}
          onChange={(next, option) => {
            if (!next) {
              setPlaceId('');
              setPlaceDraft('');
              return;
            }
            if (option?.inputValue || next.startsWith('__create__:')) {
              const label =
                option?.inputValue || option?.label || next.replace(/^__create__:/, '');
              setPlaceId('');
              setPlaceDraft(label);
              return;
            }
            const known = (locations.data?.items ?? []).find(
              (item) => item.id === next || item.label === next,
            );
            if (known) {
              setPlaceId(known.id);
              setPlaceDraft(known.label);
              return;
            }
            // Typed freeSolo string that is not yet registered.
            setPlaceId('');
            setPlaceDraft(option?.label ?? next);
          }}
        />
        <Text muted variant="caption">
          {t('photoPlaceHint')}
        </Text>
        <Stack>
          <Text variant="caption">{t('photoTags')}</Text>
          <PersonPicker
            value={tagDraft}
            onChange={addTag}
            label="photoTagPerson"
            limit={5}
            showAvatar
            clearOnSelect
          />
          <Row>
            {tagIds.map((id) => (
              <Button
                key={id}
                variant="outlined"
                onClick={() => setTagIds((current) => current.filter((item) => item !== id))}
              >
                {`${tagLabels[id] ?? id} · ${t('removeTag')}`}
              </Button>
            ))}
          </Row>
        </Stack>
        {upload.feedback}
      </Dialog>

      <Dialog
        open={!!selectedId}
        title={detail.data?.title || t('photoDetail')}
        onClose={() => {
          setSelectedId(undefined);
          void cache.invalidateQueries({ queryKey: ['album-photos'] });
        }}
      >
        <QueryState
          loading={detail.isLoading}
          error={detail.error}
          empty={!detail.data}
          retry={() => void detail.refetch()}
        >
          {detail.data && <PhotoDetailBody photo={detail.data} />}
        </QueryState>
      </Dialog>
    </Stack>
  );
}

function PhotoDetailBody({ photo }: { photo: PhotoDetail }) {
  const t = useFa();
  return (
    <Stack>
      <PhotoViewer src={photo.contentUrl} alt={photo.title || t('untitledPhoto')} />
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
      {photo.canManage && (
        <Text muted>{t('photoManageHint')}</Text>
      )}
    </Stack>
  );
}
