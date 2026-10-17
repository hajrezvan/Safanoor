import { Session } from 'src/features/session';
import { NotificationsScreen } from 'src/features/member-screens';

export default function Page() {
  return (
    <Session>
      <NotificationsScreen />
    </Session>
  );
}
