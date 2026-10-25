import 'server-only';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { getInsightQueries } from '../../composition';

/**
 * The teacher's class overview on the class page (#35): per assignment, numbers over the whole
 * class only, from three children on. No child's name, id or text reaches this component. For
 * anyone but the class's teacher (or when it cannot load) the section is simply not shown.
 */
export async function ClassLearningOverview({ classroomId }: { readonly classroomId: string }) {
  const [t, formatters, result] = await Promise.all([
    getTranslations('guidance'),
    getAppFormatters(),
    getInsightQueries().getClassLearningOverview.execute(classroomId),
  ]);
  if (result.isErr() || result.value === null) {
    return null;
  }
  const { assignments } = result.value;

  return (
    <Card>
      <CardHeader className="items-start text-left">
        <h2 className="font-heading text-2xl text-copy">{t('insights.class.title')}</h2>
        <p className="text-copy-muted">{t('insights.class.description')}</p>
      </CardHeader>
      <CardContent className="text-left">
        {assignments.length === 0 ? (
          <p className="text-copy">{t('insights.class.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((stats) => (
              <li key={stats.assignmentId} className="rounded-token-lg bg-sunken p-3">
                <p className="font-semibold text-copy">{stats.title}</p>
                <p className="text-sm text-copy-muted">
                  {stats.kind === 'too_few' ? (
                    t('insights.class.tooFew')
                  ) : (
                    <>
                      {t('insights.class.children', { count: stats.children })} ·{' '}
                      {t('insights.class.completed', { count: stats.completed })} ·{' '}
                      {t('insights.class.medianHints', {
                        median: formatters.number(stats.medianHints, { maximumFractionDigits: 1 }),
                      })}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
