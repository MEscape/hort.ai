import type { ReactNode } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { ButtonPlayground } from '../_components/button-playground';
import { CardSpecimens } from '../_components/card-specimens';
import { FeedbackSpecimens } from '../_components/feedback-specimens';
import { LessonSpecimen } from '../_components/lesson-specimen';
import { SectionPage } from '../_components/section-page';

const SECTION_SLUGS = ['buttons', 'cards', 'feedback', 'lesson'] as const;
type SectionSlug = (typeof SECTION_SLUGS)[number];

interface SectionConfig {
  readonly titleKey:
    | 'designSystem.buttons.title'
    | 'designSystem.cards.title'
    | 'designSystem.feedback.title'
    | 'designSystem.lesson.title';
  readonly descriptionKey:
    | 'designSystem.buttons.description'
    | 'designSystem.cards.description'
    | 'designSystem.feedback.description'
    | 'designSystem.lesson.description';
  readonly sourcePath: string;
}

const SECTION_CONFIG = {
  buttons: {
    titleKey: 'designSystem.buttons.title',
    descriptionKey: 'designSystem.buttons.description',
    sourcePath: 'src/components/ui/button.tsx',
  },
  cards: {
    titleKey: 'designSystem.cards.title',
    descriptionKey: 'designSystem.cards.description',
    sourcePath: 'src/components/ui/card.tsx',
  },
  feedback: {
    titleKey: 'designSystem.feedback.title',
    descriptionKey: 'designSystem.feedback.description',
    sourcePath: 'src/components/shared/feedback-panel.tsx',
  },
  lesson: {
    titleKey: 'designSystem.lesson.title',
    descriptionKey: 'designSystem.lesson.description',
    sourcePath: 'src/app/[locale]/(public)/design-system/_components/lesson-specimen.tsx',
  },
} as const satisfies Record<SectionSlug, SectionConfig>;

interface DesignSystemSectionPageProps {
  readonly params: Promise<{ locale: string; section: string }>;
}

function isSectionSlug(section: string): section is SectionSlug {
  return Object.hasOwn(SECTION_CONFIG, section);
}

function requireSectionSlug(section: string): SectionSlug {
  if (!isSectionSlug(section)) {
    notFound();
  }
  return section;
}

export function generateStaticParams() {
  return SECTION_SLUGS.map((section) => ({ section }));
}

export async function generateMetadata({
  params,
}: DesignSystemSectionPageProps): Promise<Metadata> {
  const { locale: rawLocale, section: rawSection } = await params;
  const locale = requireLocale(rawLocale);
  const section = requireSectionSlug(rawSection);
  const t = await getTranslations({ locale, namespace: 'app' });

  return buildPrivateMetadata(t(SECTION_CONFIG[section].titleKey));
}

export default async function DesignSystemSectionPage({ params }: DesignSystemSectionPageProps) {
  const { locale: rawLocale, section: rawSection } = await params;
  const locale = requireLocale(rawLocale);
  const section = requireSectionSlug(rawSection);
  const t = await getTranslations({ locale, namespace: 'app' });

  const content: Record<SectionSlug, ReactNode> = {
    buttons: <ButtonPlayground />,
    cards: <CardSpecimens locale={locale} />,
    feedback: <FeedbackSpecimens locale={locale} />,
    lesson: <LessonSpecimen showHeading={false} />,
  };
  const config = SECTION_CONFIG[section];

  return (
    <SectionPage
      locale={locale}
      title={t(config.titleKey)}
      description={t(config.descriptionKey)}
      sourcePath={config.sourcePath}
    >
      {content[section]}
    </SectionPage>
  );
}
