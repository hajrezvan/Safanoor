'use client';

import { Session } from 'src/features/session';
import { AlbumScreen } from 'src/features/album-screen';

export default function Page() {
  return (
    <Session>
      <AlbumScreen />
    </Session>
  );
}
