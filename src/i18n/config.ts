import { notFound } from 'next/navigation';

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { z } from 'zod';

import { notFoundError } from '@lib/errors';
import { err, ok, type AppResult } from '@lib/result';
import { SECONDS_PER_HOUR } from '@lib/utils';

import { I18N_ERROR_CODES } from './errors';

import type enMessages from './locales/en';

const LOCALES = ['en', 'de'] as const;

const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

const ONE_YEAR_IN_SECONDS = SECONDS_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

export type Locale = (typeof LOCALES)[number];
export type Direction = 'ltr' | 'rtl';

export type MessageCatalog = typeof enMessages;
export type Namespace = keyof MessageCatalog;

/**
 * Recursively maps a reference message catalog (English) to a structural shape
 * where every leaf string must be a string, and every nested object must have
 * the exact same keys—preventing missing or extraneous translation keys at compile time.
 */
export type TranslationSchema<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? TranslationSchema<T[K]>
      : never;
};

export interface LocaleDefinition {
  readonly label: string;
  readonly direction: Direction;
  readonly openGraphLocale: string;
  readonly htmlLang: string;
}

const LOCALE_DEFINITIONS: Readonly<Record<Locale, LocaleDefinition>> = {
  en: { label: 'English', direction: 'ltr', openGraphLocale: 'en_US', htmlLang: 'en' },
  de: { label: 'Deutsch', direction: 'ltr', openGraphLocale: 'de_DE', htmlLang: 'de' },
};

export const I18N_CONFIG = {
  locales: LOCALES,
  defaultLocale: 'en' satisfies Locale,
  definitions: LOCALE_DEFINITIONS,
  defaultTimeZone: 'Europe/Berlin',
  detection: { enabled: true },
  localeCookieMaxAgeSeconds: ONE_YEAR_IN_SECONDS,
} as const;

export const I18N_ROUTING = defineRouting({
  locales: I18N_CONFIG.locales,
  defaultLocale: I18N_CONFIG.defaultLocale,
  localePrefix: 'always',
  localeDetection: I18N_CONFIG.detection.enabled,
  localeCookie: {
    maxAge: I18N_CONFIG.localeCookieMaxAgeSeconds,
    sameSite: 'lax',
  },
  alternateLinks: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(I18N_ROUTING);

const localeSchema = z.enum(I18N_CONFIG.locales);

/**
 * Type guard checking if an unknown value is a supported `Locale`.
 */
export function isLocale(input: unknown): input is Locale {
  return typeof input === 'string' && (I18N_CONFIG.locales as readonly string[]).includes(input);
}

/**
 * Strictly validates an exact locale code (e.g., from URL route params).
 */
export function parseLocale(input: unknown): AppResult<Locale> {
  const parsed = localeSchema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(notFoundError(I18N_ERROR_CODES.unsupportedLocale, 'Unsupported locale.'));
}

/**
 * Normalizes a BCP-47 language tag (e.g., "de-DE", "EN_US", "de") into a supported `Locale`.
 * Useful for headers, external user preferences, or query parameters.
 */
export function normalizeLocale(input: unknown): AppResult<Locale> {
  if (typeof input !== 'string') {
    return err(notFoundError(I18N_ERROR_CODES.unsupportedLocale, 'Unsupported locale.'));
  }
  const trimmed = input.trim().toLowerCase();
  const exact = parseLocale(trimmed);
  if (exact.isOk()) {
    return exact;
  }
  const baseTag = trimmed.split(/[-_]/)[0];
  return parseLocale(baseTag);
}

/** The reading direction of a locale, for the `dir` attribute of the document. */
export function getDirection(locale: Locale): Direction {
  return I18N_CONFIG.definitions[locale].direction;
}

/**
 * Validates a route locale parameter or triggers Next.js `notFound()`.
 */
export function requireLocale(rawLocale: string): Locale {
  const parsed = parseLocale(rawLocale);
  if (parsed.isErr()) {
    notFound();
  }
  return parsed.value;
}

/**
 * Deterministic fallback when a message cannot be resolved at runtime.
 * Shows an unmistakable visual indicator in development and a clean key in production.
 */
export function getMessageFallback(
  { namespace, key }: { namespace?: string; key: string },
  isDevelopment: boolean,
): string {
  const qualifiedKey = namespace ? `${namespace}.${key}` : key;
  return isDevelopment ? `⚠ ${qualifiedKey}` : qualifiedKey;
}
