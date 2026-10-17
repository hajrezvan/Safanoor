import { Session } from 'src/features/session';
import { HomeScreen } from 'src/features/member-screens';

export default function Page() {
  return (
    <Session>
      <HomeScreen />
    </Session>
  );
}
