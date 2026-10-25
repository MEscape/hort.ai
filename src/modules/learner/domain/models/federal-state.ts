import { literalGuard } from '@lib/utils';

/** The 16 German federal states, by their official two-letter code. The curriculum depends on it. */
export const FEDERAL_STATES = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;

export type FederalState = (typeof FEDERAL_STATES)[number];

export const isFederalState = literalGuard(FEDERAL_STATES);

/** Primary school: grades 1 to 4. */
// eslint-disable-next-line no-magic-numbers -- the four primary-school grades are the closed set itself
export const GRADES = [1, 2, 3, 4] as const;

export type Grade = (typeof GRADES)[number];

export function isGrade(value: number): value is Grade {
  return GRADES.some((grade) => grade === value);
}
