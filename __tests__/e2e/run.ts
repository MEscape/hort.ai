import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

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

/** Shared libraries of Chromium's headless shell that Vercel's Amazon Linux 2023 build image lacks. */
const CHROMIUM_LIBRARIES = [
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
];

const runsAsRoot = process.getuid?.() === 0;

async function main() {
  const files = await readdir(process.cwd());
  if (files.some((file) => /^\.env(?:$|\.)/.test(file) && !file.endsWith('.example'))) {
    throw new Error(
      'Run E2E in a clean worktree without local .env files; Next must not load service credentials.',
    );
  }
  // No inherited deployment credentials, service URLs or VERCEL/NODE_ENV flags reach the test app.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'],
    HOME: process.env['HOME'],
    TMPDIR: tmpdir(),
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    AUTH_ENABLED: 'true',
    AUTH_SECRET: 'isolated-e2e-secret-not-a-deployment-credential',
    RATE_LIMIT_ENABLED: 'true',
    RATE_LIMIT_SECRET: 'isolated-e2e-rate-secret-not-a-deployment-credential',
    UPSTASH_REDIS_REST_TOKEN: 'isolated-e2e-token',
    MAIL_PROVIDER: 'none',
    STORAGE_PROVIDER: 'none',
    GEMINI_API_KEY: 'isolated-e2e-fake-gemini-key',
    NO_PROXY: '127.0.0.1,localhost',
  };
  if (process.env['VERCEL'] === '1' && runsAsRoot) {
    await execute(
      ['install', '-y', '-q', ...CHROMIUM_LIBRARIES],
      process.env,
      process.cwd(),
      'dnf',
    );
  }
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
    const deadline = Date.now() + 240_000;
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

await main();
