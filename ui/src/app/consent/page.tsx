import { Session } from 'src/features/session';
import { ConsentScreen } from 'src/features/member-screens';

export default function Page() {
  return (
    <Session>
      <ConsentScreen />
    </Session>
  );
}
