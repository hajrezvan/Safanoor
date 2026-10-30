'use client';

import { Session } from 'src/features/session';
import { CommunicationsScreen } from 'src/features/communications-screen';

export default function Page() {
  return (
    <Session>
      <CommunicationsScreen />
    </Session>
  );
}
