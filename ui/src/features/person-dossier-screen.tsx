'use client';

import type { TextKey } from 'src/locales/fa';
import type { components } from 'src/api/generated/schema';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatNumber } from '@safanoor/shared';

import { client, unwrap } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  QueryState,
  Row,
  Stack,
  Tabs,
  Text,
  Avatar,
  PersonCardRow,
  PersonCardMeta,
} from 'src/components/ui';

import { Permission } from './shared';
import { useSession } from './session';

type PersonDossier = components['schemas']['PersonDossierDto'];
type SectionKey = PersonDossier['sections'][number]['key'];

const SECTION_ORDER: SectionKey[] = [
  'consultations',
  'camps',
  'communications',
  'photos',
  'books',
  'payments',
];

function sectionTitleKey(key: SectionKey): TextKey {
  if (key === 'books') return 'dossierBooks';
  if (key === 'payments') return 'dossierPayments';
  if (key === 'camps') return 'dossierCamps';
  if (key === 'consultations') return 'dossierConsultations';
  if (key === 'communications') return 'dossierCommunications';
  return 'dossierPhotos';
}

function sectionEmptyKey(key: SectionKey): TextKey {
  if (key === 'books') return 'dossierBooksEmpty';
  if (key === 'payments') return 'dossierPaymentsEmpty';
  if (key === 'camps') return 'dossierCampsEmpty';
  if (key === 'consultations') return 'dossierConsultationsEmpty';
  if (key === 'communications') return 'dossierCommunicationsEmpty';
  return 'dossierPhotosEmpty';
}

function sectionUnavailableKey(key: SectionKey): TextKey {
  if (key === 'books') return 'dossierBooksUnavailable';
  if (key === 'payments') return 'dossierPaymentsUnavailable';
  return 'dossierSectionUnavailable';
}

export function PersonDossierScreen({ id }: { id: string }) {
  const t = useFa();
  const me = useSession();
  const [tab, setTab] = useState<string>('profile');
  const query = useQuery({
    queryKey: ['person-dossier', id],
    queryFn: async () =>
      unwrap(
        await client.GET('/api/v1/people/{id}/dossier', {
          params: { path: { id } },
        })
      ),
  });
  const person = query.data?.person;
  const sections = query.data?.sections ?? [];
  const byKey = Object.fromEntries(sections.map((section) => [section.key, section])) as Record<
    SectionKey,
    (typeof sections)[number] | undefined
  >;
  const fullName = person ? `${person.firstName} ${person.lastName}` : '';
  return (
    <Permission allowed={me.capabilities.managePeople}>
      <PageHeader
        title={fullName || t('personDossier')}
        hint={t('personDossierHint')}
        action={
          <Button variant="outlined" href="/admin/people" icon="back">
            {t('backToPeople')}
          </Button>
        }
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!person}
        emptyTitle={t('personDossierMissing')}
        emptyHint={t('personDossierMissingHint')}
        retry={() => void query.refetch()}
      >
        {person && (
          <Stack>
            <Card>
              <PersonCardRow>
                <Avatar name={fullName} size={56} />
                <PersonCardMeta>
                  <Text variant="subtitle">{fullName}</Text>
                  {person.phone && (
                    <Text variant="caption" muted dir="ltr">
                      {person.phone}
                    </Text>
                  )}
                  <Row>
                    <Chip>{t(person.orgLevel as TextKey)}</Chip>
                    <Chip tone={person.verified ? 'success' : 'warning'}>
                      {t(person.verified ? 'verified' : 'unverified')}
                    </Chip>
                    <Chip>{t(person.status as TextKey)}</Chip>
                    {person.groupName && <Chip>{person.groupName}</Chip>}
                  </Row>
                  {person.age > 0 && (
                    <Text muted>
                      {t('ageYears', { age: formatNumber(person.age) })}
                    </Text>
                  )}
                </PersonCardMeta>
              </PersonCardRow>
            </Card>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'profile', label: t('dossierProfile') },
                ...SECTION_ORDER.map((key) => ({
                  value: key,
                  label: t(sectionTitleKey(key)),
                })),
              ]}
            />
            {tab === 'profile' ? (
              <Card>
                <Stack>
                  <Text variant="subtitle">{t('dossierProfile')}</Text>
                  <Text muted>{t('dossierProfileHint')}</Text>
                  {person.fatherName && (
                    <Text>
                      {t('fatherName')}: {person.fatherName}
                    </Text>
                  )}
                  {person.birthDate && (
                    <Text>
                      {t('birthDate')}: {formatDate(person.birthDate)}
                    </Text>
                  )}
                  <Text>
                    {t('nationalIdMasked')}: {person.nationalIdMasked}
                  </Text>
                  <Text>
                    {t('availability')}: {t(person.availability as TextKey)}
                  </Text>
                </Stack>
              </Card>
            ) : (
              <DossierSection
                section={byKey[tab as SectionKey]}
                sectionKey={tab as SectionKey}
              />
            )}
          </Stack>
        )}
      </QueryState>
    </Permission>
  );
}

function DossierSection({
  section,
  sectionKey,
}: {
  section?: components['schemas']['PersonDossierSectionDto'];
  sectionKey: SectionKey;
}) {
  const t = useFa();
  if (!section || !section.available) {
    return (
      <Card>
        <EmptyState
          title={t(sectionTitleKey(sectionKey))}
          hint={t(sectionUnavailableKey(sectionKey))}
        />
      </Card>
    );
  }
  if (section.items.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t(sectionTitleKey(sectionKey))}
          hint={t(sectionEmptyKey(sectionKey))}
        />
      </Card>
    );
  }
  return (
    <Stack>
      {section.items.map((item) => (
        <Card key={item.id}>
          <Stack>
            <Text variant="subtitle">{item.title}</Text>
            {item.subtitle && <Text muted>{item.subtitle}</Text>}
            {item.at && (
              <Text variant="caption" muted>
                {formatDate(item.at, true)}
              </Text>
            )}
            {item.href && (
              <Button variant="outlined" size="small" href={item.href}>
                {t('openRelated')}
              </Button>
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
