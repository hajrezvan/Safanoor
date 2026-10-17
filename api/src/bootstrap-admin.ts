import 'dotenv/config';
import {
  normalizePersian,
  phoneSchema,
  passwordSchema,
} from '@safanoor/shared';
import database from './libs/database/data-source';
import { one, rows } from './libs/database/database.types';
import { PasswordProvider } from './modules/auth/password.provider';
async function main(): Promise<void> {
  const login = phoneSchema.parse(process.env.BOOTSTRAP_ADMIN_PHONE);
  const password = passwordSchema.parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const first = process.env.BOOTSTRAP_ADMIN_FIRST_NAME;
  const last = process.env.BOOTSTRAP_ADMIN_LAST_NAME;
  if (!first || !last) throw new Error('Administrator names are required');
  const hash = await new PasswordProvider().hash(password);
  await database.initialize();
  try {
    await database.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739205)');
      if (await one(manager, 'SELECT 1 FROM app_user WHERE is_admin'))
        throw new Error('An administrator already exists');
      const person = await one<{ id: string }>(
        manager,
        "INSERT INTO person(first_name,last_name,phone,org_level,external,search_name,consent_required) VALUES($1,$2,$3,'member',true,$4,true) RETURNING id",
        [first, last, login, normalizePersian(`${first} ${last}`)],
      );
      if (!person) throw new Error('Bootstrap failed');
      await rows(
        manager,
        'INSERT INTO app_user(person_id,login,password_hash,is_admin) VALUES($1,$2,$3,true)',
        [person.id, login, hash],
      );
      await rows(
        manager,
        "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,meta) VALUES($1,'account.bootstrap','admin',$1,'{}')",
        [person.id],
      );
    });
    console.log(
      '🔑 Administrator initialized. Complete consent at first login.',
    );
  } finally {
    await database.destroy();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      '❌ Bootstrap failed. Check required administrator environment values or existing accounts.',
    );
    process.exitCode = 1;
  });
