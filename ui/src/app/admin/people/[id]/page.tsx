'use client';

import { use } from 'react';

import { PersonDossierScreen } from 'src/features/person-dossier-screen';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PersonDossierScreen id={id} />;
}
