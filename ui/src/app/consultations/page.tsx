'use client';

import { Session } from 'src/features/session';
import { ConsultationsScreen } from 'src/features/consultations-screen';

export default function Page() {
  return (
    <Session>
      <ConsultationsScreen />
    </Session>
  );
}
