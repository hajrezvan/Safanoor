#!/usr/bin/env node
/**
 * Ensure a local S3-compatible object store for development (port 9000).
 *
 * Prefers official MinIO when the image can be pulled. If Docker Hub / MinIO
 * images are unavailable (common on restricted networks), falls back to the
 * repo's S3Proxy image under infra/storage — same S3 API the app already uses.
 *
 * Credentials come from api/.env (pinned by scripts/dev-env.mjs).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(
  path.join(root, 'api', 'node_modules', '@aws-sdk', 'client-s3', 'package.json'),
);
const API_PORT = 9000;
const CONSOLE_PORT = 9001;
const MINIO_NAME = 'safanoor-minio';
const S3PROXY_NAME = 'safanoor-storage';
const MINIO_IMAGE = 'minio/minio:latest';
const S3PROXY_IMAGE = 'safanoor-storage:local';

function log(message) {
  const stamp = new Date().toLocaleTimeString('fa-IR', { hour12: false });
  console.log(`[${stamp}] [storage] ${message}`);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function run(command, args, { allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFail) resolve({ stdout, stderr, code });
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for object storage on ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function containerRunning(name) {
  const { stdout, code } = await run(
    'docker',
    ['inspect', '-f', '{{.State.Running}}', name],
    { allowFail: true },
  );
  if (code !== 0) return false;
  return stdout.trim() === 'true';
}

async function containerExists(name) {
  const { code } = await run('docker', ['inspect', name], { allowFail: true });
  return code === 0;
}

async function ensureBucket(env) {
  const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: env.S3_REGION || 'us-east-1',
    endpoint: env.S3_ENDPOINT || `http://127.0.0.1:${API_PORT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
  const bucket = env.S3_BUCKET || 'safanoor';
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      log(`Bucket «${bucket}» ready.`);
      return;
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        log(`Bucket «${bucket}» created.`);
        return;
      } catch (error) {
        if (['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'].includes(error.name)) {
          log(`Bucket «${bucket}» ready.`);
          return;
        }
        if (attempt === 39) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

async function tryStartMinio(accessKey, secretKey) {
  if (await containerRunning(MINIO_NAME)) {
    log('MinIO already running.');
    return true;
  }
  if (await containerExists(MINIO_NAME)) {
    log(`Starting existing ${MINIO_NAME}…`);
    const { code } = await run('docker', ['start', MINIO_NAME], { allowFail: true });
    return code === 0;
  }
  log(`Trying official MinIO image (${MINIO_IMAGE})…`);
  const pulled = await run('docker', ['pull', MINIO_IMAGE], { allowFail: true });
  if (pulled.code !== 0) {
    log('Official MinIO image is not pullable on this network; using S3Proxy fallback.');
    return false;
  }
  await run('docker', [
    'run',
    '--name',
    MINIO_NAME,
    '-e',
    `MINIO_ROOT_USER=${accessKey}`,
    '-e',
    `MINIO_ROOT_PASSWORD=${secretKey}`,
    '-p',
    `127.0.0.1:${API_PORT}:9000`,
    '-p',
    `127.0.0.1:${CONSOLE_PORT}:9001`,
    '-v',
    'safanoor-minio-data:/data',
    '-d',
    MINIO_IMAGE,
    'server',
    '/data',
    '--console-address',
    ':9001',
  ]);
  return true;
}

async function ensureS3Proxy(accessKey, secretKey) {
  if (await containerRunning(S3PROXY_NAME)) {
    log('S3Proxy already running.');
    return;
  }
  if (await containerExists(S3PROXY_NAME)) {
    log(`Starting existing ${S3PROXY_NAME}…`);
    await run('docker', ['start', S3PROXY_NAME]);
    return;
  }
  log(`Building ${S3PROXY_IMAGE} from infra/storage…`);
  await run('docker', ['build', '-t', S3PROXY_IMAGE, path.join(root, 'infra/storage')]);
  log(`Creating container ${S3PROXY_NAME}…`);
  await run('docker', [
    'run',
    '--name',
    S3PROXY_NAME,
    '-e',
    `S3_ACCESS_KEY=${accessKey}`,
    '-e',
    `S3_SECRET_KEY=${secretKey}`,
    '-p',
    `127.0.0.1:${API_PORT}:9000`,
    '-v',
    'safanoor-s3proxy-data:/data',
    '-d',
    S3PROXY_IMAGE,
  ]);
}

export async function ensureMinio() {
  const env = {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, 'api/.env')),
  };
  const accessKey = env.S3_ACCESS_KEY || 'safanoor-local';
  const secretKey = env.S3_SECRET_KEY || 'safanoor-local-dev-minio';
  env.S3_ACCESS_KEY = accessKey;
  env.S3_SECRET_KEY = secretKey;
  env.S3_ENDPOINT = env.S3_ENDPOINT || `http://127.0.0.1:${API_PORT}`;
  env.S3_BUCKET = env.S3_BUCKET || 'safanoor';
  env.S3_REGION = env.S3_REGION || 'us-east-1';

  // Drop a failed empty MinIO create from a previous attempt.
  if (await containerExists(MINIO_NAME) && !(await containerRunning(MINIO_NAME))) {
    const inspect = await run('docker', ['inspect', '-f', '{{.State.Status}}', MINIO_NAME], {
      allowFail: true,
    });
    if (inspect.stdout.trim() === 'created') {
      await run('docker', ['rm', MINIO_NAME], { allowFail: true });
    }
  }

  const usedMinio = await tryStartMinio(accessKey, secretKey);
  if (!usedMinio) await ensureS3Proxy(accessKey, secretKey);

  await waitForPort(API_PORT);
  await ensureBucket(env);
  if (usedMinio) {
    log(`MinIO API http://127.0.0.1:${API_PORT} · console http://127.0.0.1:${CONSOLE_PORT}`);
  } else {
    log(`S3-compatible API http://127.0.0.1:${API_PORT} (S3Proxy; production MinIO goes in admin settings)`);
  }
  return env;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  ensureMinio().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
