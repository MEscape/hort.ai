import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SPEECH_LIMITS } from '@modules/voice/application/contracts/voice-constraints';
import { IssueSpeechTicket } from '@modules/voice/application/queries/issue-speech-ticket';
import type { ValidatedHint } from '@modules/voice/application/queries/issue-speech-ticket';

import { denying, voiceDependencies } from '../fakes';

function hint(text: string): ValidatedHint {
  return { kind: 'generated', level: 'understand_task', text };
}

describe('IssueSpeechTicket', () => {
  it('issues a ticket for a validated hint, bound to the signed-in parent', async () => {
    const deps = voiceDependencies();
    const query = new IssueSpeechTicket(deps);

    const result = await query.execute(hint(' Was weißt du schon? '));

    expect(result._unsafeUnwrap()).toEqual({ ticket: 'ticket:Was weißt du schon?' });
    expect(deps.tickets.issue).toHaveBeenCalledWith('Was weißt du schon?', {
      tenantId: 'default',
      actorId: 'parent-1',
    });
  });

  it('requires voice.use and refuses a hint too long to speak in one request', async () => {
    const denied = new IssueSpeechTicket(voiceDependencies({ authorization: denying() }));
    const long = new IssueSpeechTicket(voiceDependencies());

    expect((await denied.execute(hint('Hallo')))._unsafeUnwrapErr().code).toBe(
      'auth.permission_denied',
    );
    expect(
      (await long.execute(hint('a'.repeat(SPEECH_LIMITS.maxTextLength + 1))))._unsafeUnwrapErr(),
    ).toMatchObject({ fieldErrors: { text: ['voice.validation.text_too_long'] } });
  });
});

/** Every source file of the voice module, for the checks below. */
function voiceSources(dir = join(process.cwd(), 'src/modules/voice')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return voiceSources(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('voice module: recordings are never persisted', () => {
  it('reaches no database, object store or file system', () => {
    const offending = voiceSources().filter((file) =>
      /from '(@lib\/(db|storage)[^']*|@prisma\/[^']*|node:fs[^']*|fs)'/.test(
        readFileSync(file, 'utf8'),
      ),
    );

    expect(offending).toEqual([]);
  });

  it('builds its use cases from no store at all', () => {
    expect(Object.keys(voiceDependencies()).sort()).toEqual([
      'authorization',
      'consent',
      'phrases',
      'rateLimiter',
      'speech',
      'tickets',
      'voices',
    ]);
  });
});
