'use client';

import type { components } from 'src/api/generated/schema';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@safanoor/shared';

import { api, client, unwrap } from 'src/api/client';
import { Session, useSession } from 'src/features/session';
import { useFa } from 'src/locales/fa-provider';
import {
  Button,
  CardsGrid,
  Chip,
  ClassAudioPlayer,
  ClassPlaylist,
  ClassPlaylistItem,
  ClassPlaylistLayout,
  ClassPlaylistMain,
  CoverCard,
  CoverCardAction,
  CoverCardBody,
  CoverCardMedia,
  CoverCardMediaPlaceholder,
  EmptyState,
  Icon,
  Notice,
  PageHeader,
  QueryState,
  Stack,
  Text,
} from 'src/components/ui';

type ClassCard = components['schemas']['ClassCardDto'];
type ClassDetail = components['schemas']['ClassDetailDto'];
type ClassSession = components['schemas']['ClassSessionDto'];

function useClassesGroup() {
  const me = useSession();
  const groups = useQuery({
    queryKey: ['groups', 'classes'],
    queryFn: () => api.groups(),
  });
  const resolved = useMemo(() => {
    const managed = groups.data?.items.find((group) => group.canManage);
    if (managed) return { groupId: managed.id, groupName: managed.name };
    if (me.person.groupId)
      return {
        groupId: me.person.groupId,
        groupName: me.person.groupName ?? undefined,
      };
    return { groupId: null as string | null, groupName: undefined };
  }, [groups.data, me.person.groupId, me.person.groupName]);
  return {
    ...resolved,
    loading: groups.isLoading,
    error: groups.error,
    refetch: groups.refetch,
  };
}

function SessionPlayer({ session }: { session: ClassSession }) {
  const t = useFa();
  return (
    <Stack>
      {session.coverUrl ? (
        <CoverCardMedia src={session.coverUrl} alt={session.title} />
      ) : (
        <CoverCardMediaPlaceholder>
          <Icon name="classes" />
        </CoverCardMediaPlaceholder>
      )}
      <Text variant="subtitle">{session.title}</Text>
      {session.speaker ? (
        <Text muted>{t('classSpeaker', { name: session.speaker })}</Text>
      ) : null}
      <Chip>
        {t('classSessionLabel', { n: session.sessionNumber })} ·{' '}
        {t('classHeldAt', { date: formatDate(session.heldAt) })}
      </Chip>
      <Text variant="subtitle">{t('classSummary')}</Text>
      {session.summary ? (
        <Text>{session.summary}</Text>
      ) : (
        <Notice tone="info">{t('classesEmptyHint')}</Notice>
      )}
      {session.audioUrl ? (
        <Stack>
          <Text variant="subtitle">{t('classAudio')}</Text>
          <ClassAudioPlayer controls src={session.audioUrl} preload="metadata">
            {t('classAudio')}
          </ClassAudioPlayer>
        </Stack>
      ) : (
        <Notice tone="info">{t('classAudioMissing')}</Notice>
      )}
    </Stack>
  );
}

function ClassDetail({
  classId,
  onBack,
}: {
  classId: string;
  onBack: () => void;
}) {
  const t = useFa();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const detail = useQuery({
    queryKey: ['lms-class', classId, sessionId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/lms/classes/{id}', {
          params: {
            path: { id: classId },
            query: sessionId ? { sessionId } : undefined,
          },
        })
      ),
  });
  const data = detail.data as ClassDetail | undefined;
  const showPlaylist = (data?.sessionCount ?? 0) > 1 && (data?.playlist.length ?? 0) > 1;
  return (
    <Stack>
      <PageHeader
        title={data?.title ?? t('classes')}
        hint={
          data
            ? t('classSessionCount', { count: data.sessionCount })
            : undefined
        }
        action={
          <Button variant="outlined" onClick={onBack} icon="back">
            {t('backToClasses')}
          </Button>
        }
      />
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={() => void detail.refetch()}
      >
        {data && (
          showPlaylist ? (
            <ClassPlaylistLayout>
              <ClassPlaylistMain>
                <SessionPlayer session={data.activeSession} />
              </ClassPlaylistMain>
              <ClassPlaylist aria-label={t('classPlaylist')}>
                <Text variant="subtitle">{t('classPlaylist')}</Text>
                <Text muted variant="caption">
                  {t('classSelectSession')}
                </Text>
                {data.playlist.map((session) => (
                  <ClassPlaylistItem
                    key={session.id}
                    type="button"
                    $active={session.id === data.activeSession.id}
                    onClick={() => setSessionId(session.id)}
                  >
                    <Text variant="caption">
                      {t('classSessionLabel', { n: session.sessionNumber })}
                    </Text>
                    <Text variant="subtitle">{session.title}</Text>
                    {session.speaker ? (
                      <Text muted variant="caption">
                        {session.speaker}
                      </Text>
                    ) : null}
                  </ClassPlaylistItem>
                ))}
              </ClassPlaylist>
            </ClassPlaylistLayout>
          ) : (
            <SessionPlayer session={data.activeSession} />
          )
        )}
      </QueryState>
    </Stack>
  );
}

function ClassesList({
  groupId,
  groupName,
  onOpen,
}: {
  groupId: string;
  groupName?: string;
  onOpen: (id: string) => void;
}) {
  const t = useFa();
  const list = useQuery({
    queryKey: ['lms-classes', groupId],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/groups/{id}/classes', {
          params: { path: { id: groupId }, query: { page: 1, limit: 50 } },
        })
      ),
  });
  return (
    <Stack>
      <PageHeader
        title={t('classes')}
        hint={
          groupName
            ? t('classesHintWithGroup', { name: groupName })
            : t('classesHint')
        }
      />
      <QueryState
        loading={list.isLoading}
        error={list.error}
        retry={() => void list.refetch()}
      >
        {list.data && list.data.items.length === 0 ? (
          <EmptyState title={t('classesEmpty')} hint={t('classesEmptyHint')} />
        ) : (
          <CardsGrid>
            {list.data?.items.map((item: ClassCard) => (
              <CoverCard key={`${item.openAs}-${item.id}`}>
                {item.coverUrl ? (
                  <CoverCardMedia src={item.coverUrl} alt={item.title} />
                ) : (
                  <CoverCardMediaPlaceholder>
                    <Icon name="classes" />
                  </CoverCardMediaPlaceholder>
                )}
                <CoverCardBody>
                  <Text variant="subtitle">{item.title}</Text>
                  {item.speaker ? (
                    <Text muted variant="caption">
                      {t('classSpeaker', { name: item.speaker })}
                    </Text>
                  ) : null}
                  {item.summary ? (
                    <Text muted variant="caption">
                      {item.summary}
                    </Text>
                  ) : null}
                  <CoverCardAction>
                    <Chip>
                      {item.sessionCount > 1
                        ? t('classSessionCount', { count: item.sessionCount })
                        : t('classHeldAt', {
                            date: formatDate(item.heldAt),
                          })}
                    </Chip>
                    <Button
                      variant="outlined"
                      onClick={() => onOpen(item.id)}
                    >
                      {t('openClass')}
                    </Button>
                  </CoverCardAction>
                </CoverCardBody>
              </CoverCard>
            ))}
          </CardsGrid>
        )}
      </QueryState>
    </Stack>
  );
}

function ClassesScreen() {
  const t = useFa();
  const [selected, setSelected] = useState<string | null>(null);
  const { groupId, groupName, loading, error, refetch } = useClassesGroup();
  return (
    <QueryState loading={loading} error={error} retry={() => void refetch()}>
      {!groupId ? (
        <Stack>
          <PageHeader title={t('classes')} />
          <EmptyState title={t('noGroupForClasses')} />
        </Stack>
      ) : selected ? (
        <ClassDetail classId={selected} onBack={() => setSelected(null)} />
      ) : (
        <ClassesList
          groupId={groupId}
          groupName={groupName}
          onOpen={setSelected}
        />
      )}
    </QueryState>
  );
}

export default function Page() {
  return (
    <Session>
      <ClassesScreen />
    </Session>
  );
}
