#!/usr/bin/env node
/**
 * One-shot local development stack:
 *   Postgres (:55432) + API (:3001) + worker + UI (:3033)
 *
 * Usage (from repo root):
 *   npm run dev
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PG_NAME = 'safanoor-postgres';
const PG_PORT = 55432;

const children = [];
let shuttingDown = false;

function log(scope, message) {
  const stamp = new Date().toLocaleTimeString('fa-IR', { hour12: false });
  console.log(`[${stamp}] [${scope}] ${message}`);
}

function run(command, args, { cwd = root, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60_000) {
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
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function ensurePostgres() {
  try {
    await run('docker', ['inspect', '-f', '{{.State.Running}}', PG_NAME]);
  } catch {
    log('postgres', `Creating container ${PG_NAME}…`);
    await run('docker', [
      'run',
      '--name',
      PG_NAME,
      '-e',
      'POSTGRES_USER=safanoor',
      '-e',
      'POSTGRES_PASSWORD=safanoor_dev',
      '-e',
      'POSTGRES_DB=safanoor',
      '-p',
      `127.0.0.1:${PG_PORT}:5432`,
      '-d',
      'postgres:17-alpine',
    ]);
    return;
  }

  const { stdout } = await run('docker', ['inspect', '-f', '{{.State.Running}}', PG_NAME]);
  if (stdout.trim() !== 'true') {
    log('postgres', `Starting existing container ${PG_NAME}…`);
    await run('docker', ['start', PG_NAME]);
  } else {
    log('postgres', 'Already running.');
  }
}

function startLabeled(name, command, args, { cwd = root, color } = {}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  children.push(child);

  const paint = (text) => (color ? `\x1b[${color}m${text}\x1b[0m` : text);
  const forward = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.length) console.log(`${paint(`[${name}]`)} ${line}`);
      }
    });
    stream.on('end', () => {
      if (buffer.length) console.log(`${paint(`[${name}]`)} ${buffer}`);
    });
  };
  forward(child.stdout);
  forward(child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log(name, `exited (code=${code ?? 'null'} signal=${signal ?? 'null'}) — shutting down stack`);
    shutdown(code && code !== 0 ? code : 1);
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400).unref();
}

process.on('SIGINT', () => {
  log('dev', 'Stopping…');
  shutdown(0);
});
process.on('SIGTERM', () => {
  log('dev', 'Stopping…');
  shutdown(0);
});

async function main() {
  if (!existsSync(path.join(root, 'api'))) {
    throw new Error('Run this from the Safanoor repo root.');
  }

  log('dev', 'Ensuring development environment files…');
  await run(process.execPath, ['scripts/dev-env.mjs'], { cwd: root });

  log('dev', 'Ensuring Postgres…');
  await ensurePostgres();
  await waitForPort(PG_PORT);
  log('postgres', `Ready on 127.0.0.1:${PG_PORT}`);

  log('dev', 'Starting API, worker, and UI…');
  startLabeled('api', 'npm', ['run', 'start:dev'], { cwd: path.join(root, 'api'), color: '36' });
  startLabeled('worker', 'npm', ['run', 'worker'], { cwd: path.join(root, 'api'), color: '35' });
  startLabeled('ui', 'corepack', ['yarn', 'dev'], { cwd: path.join(root, 'ui'), color: '32' });

  console.log('');
  log('dev', 'UI  → http://localhost:3033');
  log('dev', 'API → http://localhost:3001  (docs: /api/docs)');
  log('dev', 'Ctrl+C stops all processes.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
