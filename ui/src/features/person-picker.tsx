'use client';

import type { TextKey } from 'src/locales/fa';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  AutocompleteSelect,
  Chip,
  Notice,
  ProfileAvatar,
  Row,
  Stack,
  Text,
} from 'src/components/ui';

type PersonOption = { value: string; label: string; photoUrl?: string };

export function PersonPicker({
  value,
  onChange,
  ownerOnly = false,
  label = 'memberPersonId',
  options: provided,
  loading = false,
  error = false,
  onSearch,
  limit = 5,
  showAvatar = true,
  clearOnSelect = false,
}: {
  value: string;
  onChange: (id: string) => void;
  ownerOnly?: boolean;
  label?: TextKey;
  options?: PersonOption[];
  loading?: boolean;
  error?: boolean;
  onSearch?: (search: string) => void;
  limit?: number;
  showAvatar?: boolean;
  clearOnSelect?: boolean;
}) {
  const t = useFa();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PersonOption>();
  const query = useQuery({
    queryKey: ['person-picker', search],
    queryFn: () => api.people(1, search),
    enabled: !provided,
  });
  const options =
    provided ??
    (query.data?.items ?? [])
      .filter((person) => !ownerOnly || person.capabilities.ownGroup)
      .map((person) => ({
        value: person.id,
        label: `${person.firstName} ${person.lastName}`,
      }));
  if (selected && !options.some((option) => option.value === selected.value))
    options.push(selected);
  return (
    <Stack>
      <AutocompleteSelect
        label={t(label)}
        value={value}
        options={options}
        limit={limit}
        showAvatar={showAvatar}
        clearOnSelect={clearOnSelect}
        loading={provided ? loading : query.isLoading}
        disabled={provided ? loading : query.isLoading}
        onInputChange={(next) => {
          setSearch(next);
          onSearch?.(next);
        }}
        onChange={(id, option) => {
          if (!id || id.startsWith('__create__:')) return;
          if (option) setSelected({ value: option.value, label: option.label, photoUrl: option.photoUrl });
          onChange(id);
        }}
      />
      {(error || query.error) && <Notice tone="error">{t('error')}</Notice>}
    </Stack>
  );
}

/** Searchable multi-select: type to filter (first `limit` hits), chips for selected. */
export function MultiPersonPicker({
  values,
  onChange,
  options,
  label,
  searchLabel,
  limit = 5,
  loading = false,
  error,
  emptyHint,
}: {
  values: string[];
  onChange: (ids: string[]) => void;
  options: PersonOption[];
  label: string;
  searchLabel: string;
  limit?: number;
  loading?: boolean;
  error?: string;
  emptyHint?: string;
}) {
  const byId = useMemo(() => new Map(options.map((row) => [row.value, row])), [options]);
  const selected = values
    .map((id) => byId.get(id) ?? { value: id, label: id })
    .filter(Boolean);
  const available = options.filter((row) => !values.includes(row.value));
  return (
    <Stack>
      <Text variant="subtitle">{label}</Text>
      {selected.length > 0 ? (
        <Row>
          {selected.map((person) => (
            <Chip
              key={person.value}
              avatar={<ProfileAvatar name={person.label} photoUrl={person.photoUrl} size={24} />}
              onDelete={() => onChange(values.filter((id) => id !== person.value))}
            >
              {person.label}
            </Chip>
          ))}
        </Row>
      ) : null}
      <AutocompleteSelect
        label={searchLabel}
        value=""
        options={available}
        limit={limit}
        showAvatar
        clearOnSelect
        loading={loading}
        disabled={loading}
        error={error}
        onChange={(id) => {
          if (!id || id.startsWith('__create__:') || values.includes(id)) return;
          onChange([...values, id]);
        }}
      />
      {options.length === 0 && emptyHint ? <Notice>{emptyHint}</Notice> : null}
    </Stack>
  );
}
