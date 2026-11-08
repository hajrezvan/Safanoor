import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import {
  ActorIdentity,
  loadActorWithRole,
} from '../access/active-role';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { AUTH_PROVIDER, AuthenticationProvider } from './password.provider';

interface LoginRow {
  id: string;
  personId: string;
  passwordHash: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  status: string;
}
interface SessionRow {
  id: string;
  userId: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
}
export const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';
  constructor(
    private readonly db: DataSource,
    private readonly jwt: JwtService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthenticationProvider,
    private readonly audit: AuditService,
  ) {}
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.provider.hash(randomBytes(32).toString('hex'));
  }
  private async issue(
    userId: string,
    transaction: EntityManager,
    familyId: string = randomUUID(),
    activeRoleId: string | null = null,
  ): Promise<TokenPair> {
    const id = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    await rows(
      transaction,
      `INSERT INTO auth_session(id,user_id,family_id,refresh_hash,csrf_hash,expires_at,active_role_id)
       VALUES($1,$2,$3,$4,$5,now()+interval '30 days',$6)`,
      [
        id,
        userId,
        familyId,
        tokenHash(refreshToken),
        tokenHash(csrfToken),
        activeRoleId,
      ],
    );
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: id },
      { expiresIn: 600, audience: 'safanoor-client', issuer: 'safanoor-api' },
    );
    return { accessToken, refreshToken, csrfToken, expiresIn: 600 };
  }
  async login(login: string, password: string): Promise<TokenPair> {
    const tokens = await this.db.transaction(async (transaction) => {
      const user = await one<LoginRow>(
        transaction,
        `SELECT u.id,u.person_id AS "personId",u.password_hash AS "passwordHash",u.failed_attempts AS "failedAttempts",u.locked_until AS "lockedUntil",p.status FROM app_user u JOIN person p ON p.id=u.person_id WHERE u.login=$1 FOR UPDATE OF u`,
        [login],
      );
      const valid = await this.provider.verify(
        user?.passwordHash ?? this.dummyHash,
        password,
      );
      if (
        !user ||
        user.status !== 'active' ||
        (user.lockedUntil && user.lockedUntil.valueOf() > Date.now())
      )
        return null;
      if (!valid) {
        await rows(
          transaction,
          `UPDATE app_user SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1`,
          [user.id],
        );
        await this.audit.record(
          user.personId,
          'auth.login_failed',
          'person',
          user.personId,
          {},
          transaction,
        );
        return null;
      }
      await rows(
        transaction,
        'UPDATE app_user SET failed_attempts=0,locked_until=NULL WHERE id=$1',
        [user.id],
      );
      await this.audit.record(
        user.personId,
        'auth.login',
        'person',
        user.personId,
        {},
        transaction,
      );
      return this.issue(user.id, transaction);
    });
    if (!tokens)
      throw new UnauthorizedException(
        'شماره همراه یا رمز عبور درست نیست، یا ورود موقتاً محدود شده است.',
      );
    return tokens;
  }
  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokens = await this.db.transaction(async (transaction) => {
      const session = await one<SessionRow & { activeRoleId: string | null }>(
        transaction,
        `SELECT id,user_id AS "userId",family_id AS "familyId",revoked_at AS "revokedAt",expires_at AS "expiresAt",
                active_role_id AS "activeRoleId"
         FROM auth_session WHERE refresh_hash=$1 FOR UPDATE`,
        [tokenHash(refreshToken)],
      );
      if (!session) return null;
      if (session.revokedAt || session.expiresAt.valueOf() <= Date.now()) {
        await rows(
          transaction,
          'UPDATE auth_session SET revoked_at=COALESCE(revoked_at,now()) WHERE family_id=$1',
          [session.familyId],
        );
        return null;
      }
      const user = await one<{ status: string }>(
        transaction,
        'SELECT p.status FROM app_user u JOIN person p ON p.id=u.person_id WHERE u.id=$1',
        [session.userId],
      );
      if (user?.status !== 'active') return null;
      const pair = await this.issue(
        session.userId,
        transaction,
        session.familyId,
        session.activeRoleId,
      );
      await rows(
        transaction,
        'UPDATE auth_session SET revoked_at=now() WHERE id=$1',
        [session.id],
      );
      return pair;
    });
    if (!tokens)
      throw new UnauthorizedException('نشست منقضی شده است. دوباره وارد شوید.');
    return tokens;
  }
  async authenticate(
    token: string,
  ): Promise<{ actor: Actor; sessionId: string }> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(
        token,
        {
          audience: 'safanoor-client',
          issuer: 'safanoor-api',
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException();
    }
    const row = await one<ActorIdentity & { activeRoleId: string | null }>(
      this.db,
      `SELECT u.id AS "userId",p.id AS "personId",u.is_admin AS "isAdmin",u.is_parent AS "isParent",
              p.org_level AS "orgLevel",p.status,p.external,p.consent_required AS "consentRequired",
              s.active_role_id AS "activeRoleId"
       FROM auth_session s
       JOIN app_user u ON u.id=s.user_id
       JOIN person p ON p.id=u.person_id
       WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>now() AND p.status='active'`,
      [payload.sid, payload.sub],
    );
    if (!row) throw new UnauthorizedException();
    const { activeRoleId, ...identity } = row;
    const { actor } = await loadActorWithRole(this.db, identity, activeRoleId);
    return { actor, sessionId: payload.sid };
  }
  async logout(actor: Actor, sessionId: string): Promise<void> {
    await rows(
      this.db,
      'UPDATE auth_session SET revoked_at=COALESCE(revoked_at,now()) WHERE family_id=(SELECT family_id FROM auth_session WHERE id=$1 AND user_id=$2)',
      [sessionId, actor.userId],
    );
    await this.audit.record(
      actor.personId,
      'auth.logout',
      'person',
      actor.personId,
    );
  }
  async changePassword(
    actor: Actor,
    current: string,
    next: string,
  ): Promise<void> {
    const user = await one<{ passwordHash: string }>(
      this.db,
      'SELECT password_hash AS "passwordHash" FROM app_user WHERE id=$1',
      [actor.userId],
    );
    if (!user || !(await this.provider.verify(user.passwordHash, current)))
      throw new UnauthorizedException('رمز فعلی درست نیست.');
    const hash = await this.provider.hash(next);
    await this.db.transaction(async (transaction) => {
      await rows(
        transaction,
        'UPDATE app_user SET password_hash=$1,password_changed_at=now() WHERE id=$2',
        [hash, actor.userId],
      );
      await rows(
        transaction,
        'UPDATE auth_session SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1',
        [actor.userId],
      );
      await this.audit.record(
        actor.personId,
        'auth.password_changed',
        'person',
        actor.personId,
        {},
        transaction,
      );
    });
  }
}
