'use client';

import { Session } from 'src/features/session';
import { MeetingsScreen } from 'src/features/meetings-screen';

export default function Page() {
  return (
    <Session>
      <MeetingsScreen />
    </Session>
  );
}
