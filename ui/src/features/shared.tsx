'use client';

import type { TextKey } from 'src/locales/fa';

import { z } from 'zod';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useFa } from 'src/locales/fa-provider';

import { Form, Input, Toast, Button, Notice, FormGrid } from 'src/components/ui';

export function useWrite<T>(fn: (input: T) => Promise<unknown>, after?: () => void) {
  const cache = useQueryClient();
  const [message, setMessage] = useState('');
  const t = useFa();
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void cache.invalidateQueries();
      setMessage(t('done'));
      after?.();
    },
  });
  return {
    ...mutation,
    feedback: (
      <>
        {mutation.error && <Notice tone="error">{mutation.error.message}</Notice>}
        <Toast message={message} onClose={() => setMessage('')} />
      </>
    ),
  };
}
export type Field = { key: string; label: TextKey; type?: string; optional?: boolean };
export function BasicForm({
  fields,
  onSubmit,
  busy,
  error,
  submit = 'save',
  initial = {},
}: {
  fields: Field[];
  onSubmit: (values: Record<string, string>) => void;
  busy?: boolean;
  error?: string;
  submit?: TextKey;
  initial?: Record<string, string>;
}) {
  const t = useFa();
  const schema = z.object(
    Object.fromEntries(
      fields.map((field) => {
        let rule = z
          .string()
          .min(field.type === 'password' ? 12 : field.key === 'reason' ? 5 : 1, t('required'));
        if (/Id$/.test(field.key)) rule = rule.uuid(t('invalid'));
        if (field.optional) return [field.key, z.string()];
        return [field.key, rule];
      })
    )
  );
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((field) => [field.key, initial[field.key] ?? ''])),
  });
  return (
    <Form onSubmit={form.handleSubmit(onSubmit)}>
      <FormGrid>
        {fields.map((field) => (
          <Controller
            key={field.key}
            name={field.key}
            control={form.control}
            render={({ field: control, fieldState }) => (
              <Input
                {...control}
                label={t(field.label)}
                type={field.type}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
      </FormGrid>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={busy}>
        {t(busy ? 'busy' : submit)}
      </Button>
    </Form>
  );
}
export function Permission({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  const t = useFa();
  return allowed ? <>{children}</> : <Notice tone="warning">{t('protectedHint')}</Notice>;
}
