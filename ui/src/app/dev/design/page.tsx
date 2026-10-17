import { notFound } from 'next/navigation';

import { DesignScreen } from 'src/features/design-screen';

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DesignScreen />;
}
