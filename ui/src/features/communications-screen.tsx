'use client';

import type { components } from 'src/api/generated/schema';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatRelativeTime, normalizePersian } from '@safanoor/shared';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import {
  Button,
  ChatCenter,
  ChatInset,
  ChatPage,
  ChatPane,
  ChatSearchPad,
  ChatSplit,
  ChatThreadHeader,
  Composer,
  EmptyState,
  Input,
  MessageBubble,
  MessageList,
  Notice,
  QueryState,
  Search,
  Skeleton,
  ThreadListItem,
  ThreadListScroll,
  useCompactLayout,
} from 'src/components/ui';

type Thread = components['schemas']['ChatThreadDto'];
type Message = components['schemas']['ChatMessageDto'];

function matchesThread(thread: Thread, query: string): boolean {
  const q = normalizePersian(query);
  if (!q) return true;
  const haystack = normalizePersian(
    [
      thread.title,
      thread.preview ?? '',
      ...(thread.participants ?? []).flatMap((p) => [p.name, p.phone ?? '']),
    ].join(' ')
  );
  return haystack.includes(q);
}

export function CommunicationsScreen() {
  const t = useFa();
  const isMobile = useCompactLayout();
  const cache = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const threads = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => api.chatThreads(),
    refetchInterval: activeId ? 5000 : false,
  });
  const messages = useQuery({
    queryKey: ['chat-messages', activeId],
    queryFn: () => api.chatMessages(activeId!),
    enabled: !!activeId,
    refetchInterval: 4000,
  });
  const filtered = useMemo(
    () => (threads.data?.items ?? []).filter((thread) => matchesThread(thread, search)),
    [threads.data?.items, search]
  );
  const active =
    filtered.find((item) => item.id === activeId) ??
    threads.data?.items.find((item) => item.id === activeId) ??
    null;
  const send = useMutation({
    mutationFn: (body: string) => api.postChatMessage(activeId!, body),
    onMutate: async (body) => {
      if (!activeId) return;
      await cache.cancelQueries({ queryKey: ['chat-messages', activeId] });
      const previous = cache.getQueryData<{ items: Message[] }>(['chat-messages', activeId]);
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        threadId: activeId,
        authorId: 'me',
        authorName: '',
        body,
        createdAt: new Date().toISOString(),
        mine: true,
      };
      cache.setQueryData(['chat-messages', activeId], {
        ...previous,
        items: [...(previous?.items ?? []), optimistic],
      });
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (activeId && context?.previous)
        cache.setQueryData(['chat-messages', activeId], context.previous);
    },
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      void cache.invalidateQueries({ queryKey: ['chat-threads'] });
    },
  });
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data?.items.length, activeId]);
  useEffect(() => {
    if (isMobile) return;
    if (!activeId && threads.data?.items[0]) setActiveId(threads.data.items[0].id);
  }, [activeId, isMobile, threads.data?.items]);
  useEffect(() => {
    if (!isMobile) setMobileChatOpen(false);
  }, [isMobile]);
  const selectThread = (id: string) => {
    setActiveId(id);
    if (isMobile) setMobileChatOpen(true);
  };
  const submit = () => {
    const body = draft.trim();
    if (!body || !activeId || !active?.canPost || send.isPending) return;
    setDraft('');
    send.mutate(body);
  };
  const showList = !isMobile || !mobileChatOpen;
  const showChat = !isMobile || mobileChatOpen;
  const messageCount = messages.data?.total ?? active?.messageCount ?? 0;
  /** Own messages (or first participant when viewing as outsider) sit on one side. */
  const outgoingAuthorIds = useMemo(() => {
    const items = messages.data?.items ?? [];
    const mineAuthors = new Set(items.filter((item) => item.mine).map((item) => item.authorId));
    if (mineAuthors.size > 0) return mineAuthors;
    const firstParticipant = active?.participants?.[0]?.id;
    if (firstParticipant) return new Set([firstParticipant]);
    const firstAuthor = items[0]?.authorId;
    return firstAuthor ? new Set([firstAuthor]) : new Set<string>();
  }, [active?.participants, messages.data?.items]);
  return (
    <ChatPage>
      <QueryState
        loading={threads.isLoading}
        error={threads.error}
        empty={!threads.data?.items.length}
        retry={() => void threads.refetch()}
        emptyTitle={t('communicationsEmpty')}
        emptyHint={t('communicationsEmptyHint')}
      >
        <ChatSplit>
          <ChatPane data-pane="list" hidden={!showList}>
            <ChatSearchPad>
              <Search
                value={search}
                onChange={setSearch}
                label={t('searchThreads')}
                placeholder={t('searchThreadsPlaceholder')}
              />
            </ChatSearchPad>
            <ThreadListScroll>
              {filtered.length === 0 ? (
                <ChatCenter>
                  <EmptyState
                    title={t('communicationsSearchEmpty')}
                    hint={t('communicationsSearchEmptyHint')}
                    icon="communications"
                  />
                </ChatCenter>
              ) : (
                filtered.map((thread: Thread) => (
                  <ThreadListItem
                    key={thread.id}
                    title={thread.title}
                    preview={thread.preview}
                    time={
                      thread.lastMessageAt
                        ? formatRelativeTime(thread.lastMessageAt)
                        : null
                    }
                    names={
                      thread.kind === 'direct'
                        ? (thread.participants ?? []).map((p) => p.name)
                        : [thread.title]
                    }
                    badge={thread.messageCount}
                    active={thread.id === activeId}
                    onSelect={() => selectThread(thread.id)}
                  />
                ))
              )}
            </ThreadListScroll>
          </ChatPane>
          <ChatPane data-pane="chat" hidden={!showChat}>
            {!active && (
              <ChatCenter>
                <EmptyState
                  title={t('selectThread')}
                  hint={t('selectThreadHint')}
                  icon="communications"
                />
              </ChatCenter>
            )}
            {active && (
              <>
                <ChatThreadHeader
                  kind={active.kind}
                  title={active.title}
                  participants={active.participants ?? []}
                  messageCount={messageCount}
                  lastActivity={
                    active.lastMessageAt
                      ? formatDate(active.lastMessageAt, true)
                      : null
                  }
                  onBack={
                    isMobile
                      ? () => {
                          setMobileChatOpen(false);
                        }
                      : undefined
                  }
                  backLabel={t('backToThreads')}
                  countLabel={t('messageCount')}
                  activityLabel={t('lastActivity')}
                  groupLabel={t('groupThread')}
                  directLabel={t('directThread')}
                />
                {messages.isLoading ? (
                  <ChatCenter>
                    <Skeleton />
                  </ChatCenter>
                ) : messages.error ? (
                  <ChatCenter>
                    <EmptyState
                      title={t('error')}
                      action={
                        <Button onClick={() => void messages.refetch()}>
                          {t('retry')}
                        </Button>
                      }
                    />
                  </ChatCenter>
                ) : !messages.data?.items.length ? (
                  <ChatCenter>
                    <EmptyState
                      title={t('noMessages')}
                      hint={t('noMessagesHint')}
                      icon="communications"
                    />
                  </ChatCenter>
                ) : (
                  <MessageList>
                    {(messages.data?.items ?? []).map((message: Message) => (
                      <MessageBubble
                        key={message.id}
                        author={message.authorName}
                        body={message.body}
                        time={formatDate(message.createdAt, true)}
                        mine={
                          message.mine || outgoingAuthorIds.has(message.authorId)
                        }
                      />
                    ))}
                    <div ref={bottom} />
                  </MessageList>
                )}
                {send.error && (
                  <ChatInset>
                    <Notice tone="error">{send.error.message}</Notice>
                  </ChatInset>
                )}
                {active.canPost ? (
                  <Composer
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit();
                    }}
                  >
                    <Input
                      label={t('messagePlaceholder')}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={send.isPending || !draft.trim()}
                    >
                      {t(send.isPending ? 'busy' : 'sendMessage')}
                    </Button>
                  </Composer>
                ) : (
                  <ChatInset>
                    <Notice tone="warning">{t('protectedHint')}</Notice>
                  </ChatInset>
                )}
              </>
            )}
          </ChatPane>
        </ChatSplit>
      </QueryState>
    </ChatPage>
  );
}
