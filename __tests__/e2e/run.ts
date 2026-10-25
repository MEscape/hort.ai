import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import EmbeddedPostgres from 'embedded-postgres';

import { fakeServices } from './fake-services';
import { seed } from './seed';

const require = createRequire(import.meta.url);

async function freePort() {
  const socket = createServer();
  await new Promise<void>((resolve) => {
    socket.listen(0, '127.0.0.1', resolve);
  });
  const address = socket.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No free port');
  }
  await new Promise<void>((resolve) => {
    socket.close(() => {
      resolve();
    });
  });
  return address.port;
}

function execute(
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd = process.cwd(),
  command = process.execPath,
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args[0] ?? ''} failed (${String(code)})`));
      }
    });
  });
}

/** What Vercel's Amazon Linux 2023 build image lacks: Chromium headless-shell libraries and useradd. */
const VERCEL_HOST_PACKAGES = [
  'alsa-lib',
  'at-spi2-atk',
  'atk',
  'dbus-libs',
  'libX11',
  'libXcomposite',
  'libXdamage',
  'libXext',
  'libXfixes',
  'libXrandr',
  'libxcb',
  'libxkbcommon',
  'mesa-libgbm',
  'nss',
  // useradd, for the unprivileged user embedded-postgres creates when the build runs as root.
  'shadow-utils',
];

const runsAsRoot = process.getuid?.() === 0;

/** The only variables any process of the test run may inherit; deployment secrets are never among them. */
const CLEAN_NAMES = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'NODE_ENV',
  'NEXT_TELEMETRY_DISABLED',
  'NO_PROXY',
  'E2E_CLEAN_ENV',
]);

/**
 * Starts this file again with an empty environment. Everything the run spawns afterwards (embedded
 * PostgreSQL, Next, Playwright) inherits from that process, so none of them can see the deployment's
 * credentials, whichever library reads `process.env`. The sentinel stands in for a deployment secret:
 * it is set here, withheld from the child, and searched for in every process the child starts.
 */
async function relaunchWithCleanEnvironment() {
  if (process.env['VERCEL'] === '1' && runsAsRoot) {
    await execute(
      ['install', '-y', '-q', ...VERCEL_HOST_PACKAGES],
      process.env,
      process.cwd(),
      'dnf',
    );
  }
  const sentinel = `leak-sentinel-${randomUUID()}`;
  process.env['E2E_LEAK_SENTINEL'] = sentinel;
  await execute(['--import', 'tsx', fileURLToPath(import.meta.url), sentinel], {
    PATH: process.env['PATH'],
    HOME: process.env['HOME'],
    TMPDIR: tmpdir(),
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    NO_PROXY: '127.0.0.1,localhost',
    E2E_CLEAN_ENV: '1',
  });
}

/** Fails closed if a running process holds any variable beyond the allowed names or the sentinel. */
async function assertCleanEnvironment(
  label: string,
  pid: number,
  allowed: ReadonlySet<string>,
  sentinel: string,
) {
  if (!existsSync('/proc/self/environ')) {
    return; // Only Linux (local hosts and Vercel builds) exposes process environments.
  }
  const raw = (await readFile(`/proc/${String(pid)}/environ`, 'utf8')).split('\0').filter(Boolean);
  const names = raw.map((entry) => entry.slice(0, entry.indexOf('=')));
  const extra = names.filter((name) => !allowed.has(name));
  if (extra.length > 0) {
    throw new Error(`${label} inherited unexpected variables: ${extra.join(', ')}`);
  }
  if (raw.some((entry) => entry.includes(sentinel))) {
    throw new Error(`${label} inherited the deployment-secret sentinel`);
  }
}

async function main(sentinel: string) {
  const files = await readdir(process.cwd());
  if (files.some((file) => /^\.env(?:$|\.)/.test(file) && !file.endsWith('.example'))) {
    throw new Error(
      'Run E2E in a clean worktree without local .env files; Next must not load service credentials.',
    );
  }
  await assertCleanEnvironment('test harness', process.pid, CLEAN_NAMES, sentinel);
  // No inherited deployment credentials, service URLs or VERCEL flags reach the test app.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AUTH_ENABLED: 'true',
    AUTH_SECRET: 'isolated-e2e-secret-not-a-deployment-credential',
    RATE_LIMIT_ENABLED: 'true',
    RATE_LIMIT_SECRET: 'isolated-e2e-rate-secret-not-a-deployment-credential',
    UPSTASH_REDIS_REST_TOKEN: 'isolated-e2e-token',
    MAIL_PROVIDER: 'none',
    STORAGE_PROVIDER: 'none',
    GEMINI_API_KEY: 'isolated-e2e-fake-gemini-key',
  };
  const directory = await mkdtemp(join(tmpdir(), 'hort-e2e-'));
  // Postgres refuses root; embedded-postgres then runs it as its own `postgres` user, which needs this directory.
  if (runsAsRoot) {
    await chmod(directory, 0o777);
  }
  const postgresPort = await freePort();
  const appPort = await freePort();
  const appUrl = `http://127.0.0.1:${appPort}`;
  const pgUrl = `postgresql://e2e:isolated@127.0.0.1:${postgresPort}`;
  const platform = dirname(
    dirname(require.resolve(`@embedded-postgres/${process.platform}-${process.arch}`)),
  );
  // npm may block package postinstall scripts; this inspected dependency script only restores its bundled symlinks.
  await execute([join(platform, 'scripts/hydrate-symlinks.js')], env, platform);
  const database = new EmbeddedPostgres({
    databaseDir: join(directory, 'postgres'),
    user: 'e2e',
    password: 'isolated',
    port: postgresPort,
    persistent: false,
    createPostgresUser: runsAsRoot,
    postgresFlags: ['-h', '127.0.0.1', '-k', directory],
    onLog: () => {},
    onError: (error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
    },
  });
  const services = await fakeServices();
  Object.assign(env, {
    DATABASE_URL: `${pgUrl}/e2e_app`,
    AUTH_DATABASE_URL: `${pgUrl}/e2e_auth`,
    NEXT_PUBLIC_APP_URL: appUrl,
    GEMINI_API_URL: services.url,
    UPSTASH_REDIS_REST_URL: `${services.url}/redis`,
    E2E_DATABASE_URL: `${pgUrl}/e2e_app`,
    E2E_BASE_URL: appUrl,
    E2E_FAKE_URL: services.url,
  });
  let next: ReturnType<typeof spawn> | undefined;
  try {
    await database.initialise();
    await database.start();
    const postmaster = (
      await readFile(join(directory, 'postgres', 'postmaster.pid'), 'utf8')
    ).split('\n')[0];
    // The server was started from this process: prove it holds nothing but this run's clean variables.
    await assertCleanEnvironment(
      'embedded PostgreSQL',
      Number(postmaster),
      new Set([...Object.keys(process.env), 'LC_MESSAGES']),
      sentinel,
    );
    await database.createDatabase('e2e_app');
    await database.createDatabase('e2e_auth');
    await execute(['node_modules/prisma/dist/prisma.js', 'db', 'migrate'], env);
    await execute(['--import', 'tsx', 'migrations/apply-auth-migration.ts'], env);
    await seed(env['DATABASE_URL'] ?? '', env['AUTH_DATABASE_URL'] ?? '');
    next = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'dev',
        '--webpack',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(appPort),
      ],
      { env, stdio: 'inherit' },
    );
    const deadline = Date.now() + 900_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (next.exitCode !== null) {
        throw new Error(`Next exited (${String(next.exitCode)})`);
      }
      try {
        const response = await fetch(`${appUrl}/de/sign-in`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* The listener/first development compilation is not ready yet. */
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
    if (!ready) {
      throw new Error('E2E app did not become ready');
    }
    if (next.pid !== undefined) {
      await assertCleanEnvironment('Next server', next.pid, new Set(Object.keys(env)), sentinel);
    }
    await execute(
      ['node_modules/playwright/cli.js', 'test', '--config', 'playwright.config.ts'],
      env,
    );
  } finally {
    if (next?.exitCode === null) {
      next.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        next?.once('exit', () => {
          resolve();
        });
      });
    }
    await services.close();
    await database.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

const cleanRunSentinel = process.argv[2];
if (process.env['E2E_CLEAN_ENV'] === '1' && cleanRunSentinel !== undefined) {
  await main(cleanRunSentinel);
} else {
  await relaunchWithCleanEnvironment();
}
