import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { normalizeInviteCode } from '../../domain/models/invite-code';

import type { NormalizedInviteCode } from '../../domain/models/invite-code';
import type { ClassroomOwnerScope } from '../../domain/ports/classroom.repository';
import type { InviteCodeVault } from '../../domain/ports/invite-code-vault.port';

const ALGORITHM = 'aes-256-gcm';
/** 96-bit nonce, the size GCM is specified for; fresh from the CSPRNG for every seal. */
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Versioned, so a later scheme can coexist with stored values: `v1.<iv>.<tag>.<ciphertext>`. */
const VERSION = 'v1';
const PARTS = 4;

function associatedData(owner: ClassroomOwnerScope): Buffer {
  return Buffer.from(`${owner.tenantId}\u0000${owner.ownerId}`, 'utf8');
}

/** Seals with AES-256-GCM: confidential and tamper-evident, bound to the class's owner. */
function sealWith(key: Buffer, code: NormalizedInviteCode, owner: ClassroomOwnerScope): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(associatedData(owner));
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

function openWith(
  key: Buffer,
  sealed: string,
  owner: ClassroomOwnerScope,
): NormalizedInviteCode | null {
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (sealed.split('.').length !== PARTS || version !== VERSION) {
    return null;
  }
  if (iv === undefined || tag === undefined || ciphertext === undefined) {
    return null;
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(associatedData(owner));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return normalizeInviteCode(plain);
  } catch {
    // Another key, another owner or a damaged value: the authentication tag does not verify.
    return null;
  }
}

/**
 * The vault for `CLASSROOM_INVITE_CODE_KEY`: base64 of 32 bytes, which the configuration schema
 * guarantees at startup. Without a key it seals nothing and opens nothing, which is the hash-only
 * behaviour classes had before.
 */
export function createAesGcmInviteCodeVault(base64Key: string | undefined): InviteCodeVault {
  const key = base64Key === undefined ? null : Buffer.from(base64Key, 'base64');
  return {
    seal: (code, owner) => (key === null ? null : sealWith(key, code, owner)),
    open: (sealed, owner) => (key === null ? null : openWith(key, sealed, owner)),
  };
}
