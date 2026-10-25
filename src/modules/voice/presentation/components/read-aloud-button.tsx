'use client';

import { Spinner, Square, Volume2 } from '@components/ui/icons';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { CompanionMessageRef } from '../../application/contracts/voice-constraints';
import { useReadAloud } from '../hooks/use-read-aloud';

export interface ReadAloudButtonProps {
  /** The child the message was for: the server checks it is the parent's own. */
  readonly childProfileId: string;
  /** Which message to read, never its words: the server looks them up. Key the button by it. */
  readonly message: CompanionMessageRef;
  /** What the parent stored (`voiceConsent`). Without it there is no button at all. */
  readonly allowed: boolean;
  readonly className?: string;
}

/**
 * "Vorlesen" under a message of the companion (#34): the companion reads it in their own voice.
 * Only the words the server validated and stored are spoken; pressing again stops.
 */
export function ReadAloudButton({ allowed, ...control }: ReadAloudButtonProps) {
  if (!allowed) {
    return null;
  }
  return <ReadAloudControl {...control} />;
}

function ReadAloudControl({
  childProfileId,
  message,
  className,
}: Omit<ReadAloudButtonProps, 'allowed'>) {
  const t = useTranslations('voice');
  const voice = useReadAloud(childProfileId, message);
  const playing = voice.status === 'playing';
  const loading = voice.status === 'loading';
  let label = t('readAloud.play');
  if (loading) {
    label = t('readAloud.loading');
  } else if (playing) {
    label = t('readAloud.stop');
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={playing}
        aria-busy={loading}
        onClick={voice.toggle}
      >
        {loading && <Spinner className="animate-spin" aria-hidden="true" />}
        {!loading && playing && <Square className="fill-current" aria-hidden="true" />}
        {!loading && !playing && <Volume2 aria-hidden="true" />}
        {label}
      </Button>
      {voice.problem !== null && (
        <p role="status" className="mt-1 text-sm text-copy-muted">
          {t(`readAloud.problem.${voice.problem}`)}
        </p>
      )}
    </div>
  );
}
