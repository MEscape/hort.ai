import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { VOICE_ERROR_CODES } from '../../domain/errors/voice-errors';

import { VOICE_CONSENT_SELECT, toVoiceConsent } from './voice-consent-record-mapper';

import type { VoiceConsent, VoiceConsentHolder } from '../../domain/models/voice-consent';
import type { VoiceConsentRepository } from '../../domain/ports/voice-consent.repository';

const failures = createPersistenceFailures({
  module: 'voice.persistence',
  code: VOICE_ERROR_CODES.persistenceFailed,
  subject: 'VoiceConsent',
});

/** The holder's row: the primary key is (tenantId, parentId), so this is one row at most. */
function holderRow(holder: VoiceConsentHolder) {
  return db.orm.public.VoiceConsent.where({
    tenantId: holder.tenantId,
    parentId: holder.parentId,
  });
}

/** Prisma-backed consent store, the only place that touches `db` for it; failures are logged once here. */
export class PrismaVoiceConsentRepository implements VoiceConsentRepository {
  find(holder: VoiceConsentHolder): AppResultAsync<VoiceConsent | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        holderRow(holder)
          .select(...VOICE_CONSENT_SELECT)
          .first(),
      failures.infraOnly('find'),
    ).map((record) => (record === null ? null : toVoiceConsent(record)));
  }

  grant(
    holder: VoiceConsentHolder,
    at: Date,
  ): AppResultAsync<VoiceConsent, InfrastructureAppError> {
    const grantedAt = dateToInstant(at);
    return fromThrowableAsync(
      async () =>
        db.orm.public.VoiceConsent.select(...VOICE_CONSENT_SELECT).upsert({
          create: {
            tenantId: holder.tenantId,
            parentId: holder.parentId,
            grantedAt,
            revokedAt: null,
          },
          update: { grantedAt, revokedAt: null },
        }),
      failures.infraOnly('grant'),
    ).map(toVoiceConsent);
  }

  revoke(
    holder: VoiceConsentHolder,
    at: Date,
  ): AppResultAsync<VoiceConsent | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        holderRow(holder)
          .where((consent) => consent.revokedAt.isNull())
          .select(...VOICE_CONSENT_SELECT)
          .update({ revokedAt: dateToInstant(at) }),
      failures.infraOnly('revoke'),
    ).andThen((revoked) =>
      // Nothing matched: never granted, or already revoked (that revocation stands).
      revoked === null ? this.find(holder) : okAsync(toVoiceConsent(revoked)),
    );
  }
}
