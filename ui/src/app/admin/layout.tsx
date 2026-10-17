import { Session } from 'src/features/session';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Session>{children}</Session>;
}
