import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/auth/jwt/sign-in');
}
