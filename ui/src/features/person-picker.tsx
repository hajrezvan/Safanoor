'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import { Stack, Search, Select, Notice } from 'src/components/ui';

export function PersonPicker({
  value,
  onChange,
  ownerOnly = false,
}: {
  value: string;
  onChange: (id: string) => void;
  ownerOnly?: boolean;
}) {
  const t = useFa();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ value: string; label: string }>();
  const query = useQuery({
    queryKey: ['person-picker', search],
    queryFn: () => api.people(1, search),
  });
  const options = (query.data?.items ?? [])
    .filter((person) => !ownerOnly || person.capabilities.ownGroup)
    .map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }));
  if (selected && !options.some((option) => option.value === selected.value))
    options.push(selected);
  return (
    <Stack>
      <Search value={search} onChange={setSearch} />
      <Select
        label={t(ownerOnly ? 'owner' : 'memberPersonId')}
        value={value}
        onChange={(id) => {
          setSelected(options.find((option) => option.value === id));
          onChange(id);
        }}
        options={options}
        disabled={query.isLoading}
      />
      {query.error && <Notice tone="error">{t('error')}</Notice>}
    </Stack>
  );
}
