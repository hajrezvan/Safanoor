import { Session } from 'src/features/session';
import { ProfileScreen } from 'src/features/member-screens';

export default function Page() {
  return (
    <Session>
      <ProfileScreen />
    </Session>
  );
}
