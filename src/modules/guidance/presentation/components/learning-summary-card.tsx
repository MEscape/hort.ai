import 'server-only';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { getInsightQueries } from '../../composition';
import { LEVEL_LABEL_KEYS, STATUS_LABEL_KEYS } from '../insights/insight-label-keys';

interface LearningSummaryCardProps {
  /** The signed-in parent's own child; the query checks that again. */
  readonly childProfileId: string;
  readonly childName: string;
}

/**
 * The parent's short summary on the home page (#35): where the child needed help in the last 14
 * days, by topic name, status and hints. No text the child wrote and no AI text is shown. When the
 * summary cannot load, the card is left out so the rest of the home page keeps working.
 */
export async function LearningSummaryCard({ childProfileId, childName }: LearningSummaryCardProps) {
  const [t, formatters, result] = await Promise.all([
    getTranslations('guidance'),
    getAppFormatters(),
    getInsightQueries().getLearningSummary.execute({ childProfileId }),
  ]);
  if (result.isErr()) {
    return null;
  }
  const view = result.value;
  const topic = (label: string | null) => label ?? t('insights.parent.ownTask');
  const topics = (labels: ReadonlyArray<string | null>) => labels.map(topic).join(', ');

  return (
    <Card>
      <CardHeader className="items-start text-left">
        <h2 className="font-heading text-2xl text-copy">
          {t('insights.parent.title', { name: childName })}
        </h2>
        <p className="text-copy-muted">{t('insights.parent.window')}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-left">
        {view.kind === 'off' && <p className="text-copy">{t('insights.parent.off')}</p>}
        {view.kind === 'on' && view.summary.sessions.length === 0 && (
          <p className="text-copy">{t('insights.parent.empty')}</p>
        )}
        {view.kind === 'on' && view.summary.sessions.length > 0 && (
          <>
            {view.summary.neededManyHints.length > 0 && (
              <p className="text-copy">
                {t('insights.parent.manyHints', {
                  name: childName,
                  topics: topics(view.summary.neededManyHints),
                })}
              </p>
            )}
            {view.summary.understood.length > 0 && (
              <p className="text-copy">
                {t('insights.parent.understood', {
                  name: childName,
                  topics: topics(view.summary.understood),
                })}
              </p>
            )}
            <ul aria-label={t('insights.parent.sessionsLabel')} className="space-y-2">
              {view.summary.sessions.map((session) => (
                <li
                  key={session.startedAt.toISOString()}
                  className="rounded-token-lg bg-sunken p-3"
                >
                  <p className="font-semibold text-copy">{topic(session.label)}</p>
                  <p className="text-sm text-copy-muted">
                    {formatters.dateTime(session.startedAt)} ·{' '}
                    {t(STATUS_LABEL_KEYS[session.status])} ·{' '}
                    {t('insights.parent.hints', { count: session.hintCount })}
                    {session.highestHintLevel !== null && (
                      <>
                        {' '}
                        {t('insights.parent.highestLevel', {
                          level: t(LEVEL_LABEL_KEYS[session.highestHintLevel]),
                        })}
                      </>
                    )}
                    {session.comprehensionAnswered && (
                      <> · {t('insights.parent.comprehensionAnswered')}</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
