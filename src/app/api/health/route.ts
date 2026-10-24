import { connection } from 'next/server';

/**
 * Liveness probe for the platform and Docker. It deliberately does not
 * touch the database, so a DB blip cannot make the platform kill a healthy
 * web process. `connection()` keeps it a per-request answer instead of a
 * response prerendered at build time.
 *
 * @authorization none Reports only that the process answers; it reads no data.
 */
export async function GET() {
  await connection();
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
