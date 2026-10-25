'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { VOICE_NOTICE_VERSION } from '../../application/contracts/learner-constraints';
import { useVoiceConsent } from '../hooks/use-voice-consent';

import { SettingRow } from './setting-row';
import { SettingsGroup } from './settings-group';

export interface VoiceConsentSwitchProps {
  readonly profileId: string;
  readonly name: string;
  /** What the server stored: the switch is on only with a confirmed, current notice. */
  readonly allowed: boolean;
}

/**
 * The parent's speech-to-text decision on their home (#34): the notice says what happens to a
 * recording, switching on confirms this version of it, switching off withdraws at once.
 */
export function VoiceConsentSwitch({ profileId, name, allowed }: VoiceConsentSwitchProps) {
  const t = useTranslations('learner');
  const id = useId();
  const consent = useVoiceConsent(profileId, allowed);

  return (
    <SettingsGroup title={t('voiceConsent.group')}>
      <SettingRow
        titleId={`${id}-title`}
        descriptionId={`${id}-description`}
        title={t('voiceConsent.title', { name })}
        description={t('voiceConsent.notice', { name })}
        stateText={consent.allowed ? t('voiceConsent.on') : t('voiceConsent.off')}
      >
        <Switch
          checked={consent.allowed}
          onCheckedChange={consent.change}
          disabled={consent.isPending}
          aria-busy={consent.isPending}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description ${id}-version`}
        />
      </SettingRow>
      <p id={`${id}-version`} className="px-4 pb-4 text-sm text-copy-muted">
        {t('voiceConsent.version', { version: VOICE_NOTICE_VERSION })}
      </p>
      <FormAlert id={`${id}-error`} message={consent.error} />
    </SettingsGroup>
  );
}
