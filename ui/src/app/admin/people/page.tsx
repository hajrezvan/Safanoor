import { Suspense } from 'react';

import { PeopleScreen } from 'src/features/admin-screens';

export default function PeoplePage() {
  return (
    <Suspense>
      <PeopleScreen />
    </Suspense>
  );
}
