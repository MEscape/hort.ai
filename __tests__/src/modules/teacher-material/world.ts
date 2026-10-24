import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { MaterialDependencies } from '@modules/teacher-material/application/material-dependencies';
import type { Material } from '@modules/teacher-material/domain/models/material';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { ObjectLocation } from '@lib/storage';

import { createTestRateLimiter } from '../../support/rate-limiting';
import { parent, recordingAudit } from '../auth/fakes';

export function world() {
  let actor: Actor = parent({ id: toActorId('teacher-1'), roles: ['teacher'] });
  const rows: Material[] = [];
  const sections = new Map<
    string,
    readonly { text: string; code: string; section: string; page: number | null }[]
  >();
  const bytes = new TextEncoder().encode('- Zahlen bis 1000 vergleichen und ordnen.');
  const state = {
    signedAfterRow: false,
    location: null as ObjectLocation | null,
    bytes,
    size: bytes.length,
    mime: 'text/plain',
    deleted: false,
    rows,
    sections,
    input: {
      classroomId: 'class-1',
      title: 'Zahlen',
      contentType: 'text/plain',
      sizeBytes: bytes.length,
    },
  };
  const deps: MaterialDependencies = {
    authorization: createAuthorizationService({
      currentActor: { getCurrentActor: () => okAsync(actor) },
      audit: recordingAudit(),
    }),
    classrooms: {
      requireOwned: (id) =>
        actor.id === 'teacher-1' && id === 'class-1'
          ? okAsync({ id, status: 'active' })
          : errAsync(forbiddenError('auth.permission_denied', 'Denied')),
    },
    materials: {
      create: (row) => {
        rows.push(row);
        return okAsync(row);
      },
      find: (id, ownerId, tenantId) =>
        okAsync(
          rows.find(
            (r) => r.id === id && r.ownerId === ownerId && r.tenantId === tenantId,
          ) ?? null,
        ),
      list: (classroomId, scope) =>
        okAsync(
          rows.filter(
            (r) =>
              r.classroomId === classroomId &&
              r.ownerId === scope.ownerId &&
              r.tenantId === scope.tenantId &&
              r.status !== 'DELETED',
          ),
        ),
      process: (row, statements) => {
        if (row.status !== 'UPLOADED') return okAsync(false);
        sections.set(row.id, statements);
        row.status = 'PROCESSED';
        return okAsync(true);
      },
      retire: (row, status) => {
        row.status = status;
        sections.delete(row.id);
        return okAsync(undefined);
      },
    },
    store: {
      supports: () => true,
      publicUrl: () => null,
      createUploadTarget: ({ location }) => {
        state.signedAfterRow = rows.length > 0;
        state.location = location;
        return okAsync({
          kind: 'http-put',
          url: 'https://storage.test/upload',
          headers: {},
          expiresAt: new Date('2026-10-25'),
        });
      },
      head: () =>
        okAsync({ byteSize: state.size, contentType: state.mime, etag: null, lastModified: null }),
      readStart: (_location, count) => okAsync(state.bytes.slice(0, count)),
      delete: () => {
        state.deleted = true;
        return okAsync(undefined);
      },
      createReadUrl: () => okAsync('https://storage.test/read'),
    },
    textReader: { read: () => okAsync(state.bytes) },
    ingest: {
      extract: (text) => [
        { text: text.replace(/^- /, ''), code: 's00-01', section: 'Dokument', page: null },
      ],
    },
    newId: () => 'material-1',
    rateLimiter: createTestRateLimiter(),
    audit: { record: () => undefined },
  };
  return Object.assign(state, {
    deps,
    as: (next: Actor) => {
      actor = next;
    },
  });
}
