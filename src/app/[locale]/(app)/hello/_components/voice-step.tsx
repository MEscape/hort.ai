'use client';

import type { TutorOption } from '@modules/learner/client';

import { VoicePreview } from '@components/shared/voice-preview';
import { Mic } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { SpeechBubble } from './speech-bubble';
import { StepButton } from './step-button';
import { StepScene } from './step-scene';
import { hasTranslatedVoice, voiceWordsOf } from './voice-words';

export interface VoiceStepProps {
  /** The chosen companion; its stored introduction is the voice the child previews. */
  readonly tutor: TutorOption;
  /** The parent's consent for talking by voice. The preview plays either way (it is a stored recording). */
  readonly voiceAllowed: boolean;
  readonly onContinue: () => void;
}

/**
 * Step 4: hear the chosen companion. There is no voice catalog, a companion's voice is its stored
 * introduction, so there is nothing to pick: the companion (or the round button) plays it, never by
 * itself, while its mouth moves, and its bubble says in two or three words how it sounds. The
 * words of the recording are there for a screen reader. If the parent switched talking by voice
 * off, a small muted chip says so. Going on never depends on the sound.
 */
export function VoiceStep({ tutor, voiceAllowed, onContinue }: VoiceStepProps) {
  const t = useTranslations('learner');
  const { name } = tutor;

  return (
    <StepScene
      title={t('welcomeCompanion.voice.title')}
      footer={
        <StepButton label={t('childWelcome.actions.next')} isPending={false} onClick={onContinue} />
      }
    >
      <VoicePreview
        key={tutor.id}
        url={tutor.introUrl}
        imageUrl={tutor.imageUrl}
        imageOpenUrl={tutor.imageOpenUrl === '' ? undefined : tutor.imageOpenUrl}
        openAlignment={tutor.openAlignment}
        face={tutor.face}
        bubble={
          // Translated by the companion's id; a companion nobody translated yet keeps the catalog's German.
          hasTranslatedVoice(tutor.id) ? (
            <SpeechBubble text={t(`welcomeCompanion.voice.words.${tutor.id}`)} />
          ) : (
            <div lang="de" className="max-w-full">
              <SpeechBubble text={voiceWordsOf(tutor.voice)} />
            </div>
          )
        }
        labels={{
          play: t('welcomeCompanion.voice.play', { name }),
          stop: t('welcomeCompanion.voice.stop'),
          retry: t('welcomeCompanion.voice.retry'),
          loading: t('welcomeCompanion.voice.loading'),
          speaking: t('welcomeCompanion.voice.speaking', { name }),
          unavailable: t('welcomeCompanion.voice.unavailable'),
          failed: t('welcomeCompanion.voice.failed'),
          progress: t('welcomeCompanion.voice.progress'),
        }}
      />
      <p className="sr-only">
        {t('welcomeCompanion.voice.saysLabel', { name })}: <span lang="de">{tutor.greeting}</span>
      </p>
      {!voiceAllowed && (
        <p className="flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-copy-muted">
          <Mic className="size-4" aria-hidden="true" />
          {t('welcomeCompanion.voice.talkOff')}
        </p>
      )}
    </StepScene>
  );
}
