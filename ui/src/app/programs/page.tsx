import { Session } from 'src/features/session';
import { ProgramsScreen } from 'src/features/programs-screen';

export default function Page() {
  return (
    <Session>
      <ProgramsScreen />
    </Session>
  );
}
