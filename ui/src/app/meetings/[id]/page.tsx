'use client';

import { use } from 'react';

import { Session } from 'src/features/session';
import { MeetingDetailScreen } from 'src/features/meetings-screen';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Session>
      <MeetingDetailScreen id={id} />
    </Session>
  );
}
