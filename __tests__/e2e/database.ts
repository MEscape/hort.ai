import { Client } from 'pg';

/** Never falls through to libpq defaults or a deployment's DATABASE_URL. */
export function testClient() {
  const raw = process.env['E2E_DATABASE_URL'];
  if (raw === undefined) {
    throw new Error('Start E2E through npm run test:e2e');
  }
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.username !== 'e2e' || url.pathname !== '/e2e_app') {
    throw new Error('E2E database must be the private local fixture');
  }
  return new Client({ connectionString: raw });
}
