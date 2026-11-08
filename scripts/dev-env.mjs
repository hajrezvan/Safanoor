import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LOCAL_MINIO = {
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'safanoor',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'safanoor-local',
  S3_SECRET_KEY: 'safanoor-local-dev-minio',
};

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function upsertEnvFile(filePath, updates, { createIfMissing = true } = {}) {
  if (!existsSync(filePath)) {
    if (!createIfMissing) return;
    writeFileSync(
      filePath,
      Object.entries(updates)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    );
    return;
  }
  let text = readFileSync(filePath, 'utf8');
  if (text.length && !text.endsWith('\n')) text += '\n';
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, `${key}=${value}`);
    else text += `${key}=${value}\n`;
  }
  writeFileSync(filePath, text, { mode: 0o600 });
}

const key = randomBytes(32).toString('base64');
const shared = {
  DATABASE_URL: 'postgresql://safanoor:safanoor_dev@localhost:55432/safanoor',
  JWT_SECRET: randomBytes(48).toString('hex'),
  ENCRYPTION_KEYS: JSON.stringify({ v1: key }),
  ENCRYPTION_KEY_ID: 'v1',
  NATIONAL_ID_HMAC_KEY: randomBytes(48).toString('hex'),
  APP_ORIGIN: 'http://localhost:3033',
  HOST: '0.0.0.0',
  PORT: '3001',
  NODE_ENV: 'development',
  MONEY_UNIT: 'toman',
  STORAGE_SIGNING_KEY: randomBytes(48).toString('hex'),
  LOCAL_STORAGE_PATH: '.storage',
  ...LOCAL_MINIO,
};

if (!existsSync('api/.env')) {
  writeFileSync(
    'api/.env',
    Object.entries(shared)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  console.log('🔑 Created local API environment with random development keys + MinIO defaults.');
} else {
  // Keep JWT/encryption secrets; always pin local MinIO connection for npm run dev.
  // Production MinIO is configured in admin settings (DB), not by rewriting these.
  upsertEnvFile('api/.env', LOCAL_MINIO, { createIfMissing: false });
  console.log('📦 API storage defaults point at local MinIO.');
}

if (!existsSync('ui/.env.local')) {
  writeFileSync(
    'ui/.env.local',
    'API_INTERNAL_URL=http://localhost:3001\nNEXT_PUBLIC_API_BASE_URL=/\n',
    { mode: 0o600 },
  );
}

const rootEnv = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const rootPatch = {
  POSTGRES_PASSWORD: rootEnv.POSTGRES_PASSWORD || randomBytes(32).toString('hex'),
  DB_APP_PASSWORD: rootEnv.DB_APP_PASSWORD || randomBytes(32).toString('hex'),
  S3_ACCESS_KEY: rootEnv.S3_ACCESS_KEY || LOCAL_MINIO.S3_ACCESS_KEY,
  S3_SECRET_KEY: rootEnv.S3_SECRET_KEY || LOCAL_MINIO.S3_SECRET_KEY,
  APP_ORIGIN: rootEnv.APP_ORIGIN || 'http://localhost:8080',
};
if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    Object.entries(rootPatch)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
} else {
  upsertEnvFile('.env', {
    S3_ACCESS_KEY: rootPatch.S3_ACCESS_KEY,
    S3_SECRET_KEY: rootPatch.S3_SECRET_KEY,
  });
}
