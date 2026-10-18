import { ageOn } from '@safanoor/shared';

export const demoAccountNumbers = [
  1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 31, 32,
  40,
] as const;

export interface DemoPerson {
  id: string;
  number: number;
  firstName: string;
  lastName: string;
  fatherName: string | null;
  birthDate: string | null;
  phone: string;
  level: string;
  external: boolean;
  isParent: boolean;
  isAdmin: boolean;
  mentorId: string | null;
}

export function demoFixtureId(kind: 4 | 5 | 6 | 7 | 8, number: number): string {
  return `${kind}0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function demoBirthDate(age: number, number: number): string {
  const year = new Date().getUTCFullYear();
  const suffix = `${String((number % 9) + 1).padStart(2, '0')}-${String(2 + ((number * 3) % 24)).padStart(2, '0')}`;
  const date = `${year - age}-${suffix}`;
  return ageOn(date) === age ? date : `${year - age - 1}-${suffix}`;
}

export function demoNotificationTypes(person: DemoPerson): string[] {
  const role = person.isAdmin
    ? 'admin'
    : person.isParent
      ? 'parent'
      : person.level;
  return [
    'demo.profile',
    `demo.${role}`,
    'demo.privacy',
    'demo.security',
    'demo.guide',
  ];
}
