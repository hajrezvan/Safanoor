'use client';

import type { components } from 'src/api/generated/schema';

import { useState, useEffect } from 'react';
import { latinDigits, formatNumber, persianDigits } from '@safanoor/shared';

import { useFa } from 'src/locales/fa-provider';

import {
  Row,
  Text,
  Input,
  Stack,
  Button,
  Dialog,
  PageSlider,
  CompletionMark,
} from 'src/components/ui';

type Item = components['schemas']['StudyPathItemDto'];
export function BookReading({
  item,
  busy,
  onSave,
}: {
  item: Item;
  busy: boolean;
  onSave: (
    status: Item['readingStatus'],
    currentPage: number,
    confirmCompleted?: boolean
  ) => Promise<unknown>;
}) {
  const t = useFa();
  const [page, setPage] = useState(item.currentPage);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setPage(item.currentPage);
  }, [item.currentPage]);
  const save = async (value: number, completed = false) => {
    setError('');
    try {
      await onSave(completed ? 'completed' : 'reading', value, completed);
      if (completed) setConfirm(false);
    } catch {
      setError(t('error'));
    }
  };
  const commit = (value: number) => {
    if (!item.totalPages || !Number.isInteger(value) || value < 0 || value > item.totalPages) {
      setError(t('invalid'));
      return;
    }
    if (value === item.totalPages) setConfirm(true);
    else void save(value);
  };
  const decline = () => {
    const back = Math.max(0, (item.totalPages ?? 1) - 1);
    setConfirm(false);
    setPage(back);
    void save(back);
  };
  if (item.readingStatus === 'completed') return null;
  if (!item.totalPages)
    return (
      <Text muted variant="caption">
        {t('bookPagesMissing')}
      </Text>
    );
  return (
    <Stack>
      {item.readingStatus === 'not_started' ? (
        <Button disabled={busy} onClick={() => void save(0)}>
          {t('readingBegin')}
        </Button>
      ) : (
        <>
          <Text variant="caption">
            {t('readingPageProgress', {
              page: formatNumber(page),
              total: formatNumber(item.totalPages),
            })}
          </Text>
          <PageSlider
            label={t('readingCurrentPage')}
            max={item.totalPages}
            value={Math.max(0, Math.min(page, item.totalPages))}
            disabled={busy}
            onChange={setPage}
            onCommit={commit}
          />
          <Input
            label={t('readingCurrentPage')}
            value={persianDigits(String(page))}
            inputMode="numeric"
            disabled={busy}
            onChange={(e) => setPage(Number(latinDigits(e.target.value).replace(/\D/g, '')))}
          />
          <Button size="small" variant="outlined" disabled={busy} onClick={() => commit(page)}>
            {t('readingSavePage')}
          </Button>
          {error && <Text>{error}</Text>}
        </>
      )}
      <Dialog
        open={confirm}
        title={t('readingFinishQuestion')}
        onClose={() => {
          if (!busy) decline();
        }}
        actions={
          <Row>
            <Button disabled={busy} onClick={() => void save(item.totalPages!, true)}>
              {t('readingFinishYes')}
            </Button>
            <Button variant="text" disabled={busy} onClick={decline}>
              {t('readingFinishNo')}
            </Button>
          </Row>
        }
      >
        <CompletionMark />
        <Text>{t('readingFinishHint')}</Text>
      </Dialog>
    </Stack>
  );
}
