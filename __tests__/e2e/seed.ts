import { hashPassword } from 'better-auth/crypto';
import { Client } from 'pg';

export const PARENT_EMAIL = 'journey-parent@example.org';
export const PASSWORD = 'synthetic-e2e-password';

/** Synthetic fixtures in this run's private databases; never invoked with a supplied database URL. */
export async function seed(appUrl: string, authUrl: string) {
  const app = new Client({ connectionString: appUrl });
  const auth = new Client({ connectionString: authUrl });
  await app.connect();
  await auth.connect();
  try {
    const password = await hashPassword(PASSWORD);
    for (const [id, email] of [
      ['e2e-parent', PARENT_EMAIL],
      ['e2e-other', 'other@example.org'],
    ]) {
      await auth.query(
        'INSERT INTO "user" (id, name, email, "emailVerified", role) VALUES ($1, $1, $2, true, \'parent\')',
        [id, email],
      );
      await auth.query(
        'INSERT INTO account (id, "accountId", "providerId", "userId", password, "updatedAt") VALUES ($1, $1, \'credential\', $1, $2, now())',
        [id, password],
      );
    }
    for (const [id, owner, name] of [
      ['e2e-child', 'e2e-parent', 'Mia'],
      ['e2e-foreign-child', 'e2e-other', 'NichtDeinKind'],
    ]) {
      await app.query(
        `INSERT INTO "ChildProfile" (id, "tenantId", "ownerId", "displayName", "federalState", grade, "setupStep", "tutorId", "setupCompletedAt", "guardianConfirmedAt", "guardianConsentVersion", "welcomeCompletedAt")
        VALUES ($1, 'default', $2, $3, 'HE', 3, 'done', 'lili', now(), now(), 'v1', now())`,
        [id, owner, name],
      );
    }
    await app.query(
      `INSERT INTO "Classroom" (id, "tenantId", "ownerId", name, "federalState", grade, subject, "inviteCodeHash")
      VALUES ('e2e-class', 'default', 'e2e-teacher', 'E2E Klasse', 'HE', 3, 'MATH', $1)`,
      ['a'.repeat(64)],
    );
    await app.query(
      `INSERT INTO "ClassMembership" (id, "tenantId", "classroomId", "childProfileId") VALUES ('e2e-member', 'default', 'e2e-class', 'e2e-child')`,
    );
    await app.query(`INSERT INTO "Assignment" (id, "tenantId", "ownerId", "classroomId", title, "taskText", "solutionKey")
      VALUES ('e2e-assignment', 'default', 'e2e-teacher', 'e2e-class', 'Unsere Plusaufgabe', 'Rechne 36 + 47 und beschreibe deinen Weg.', '83')`);
  } finally {
    await app.end();
    await auth.end();
  }
}
