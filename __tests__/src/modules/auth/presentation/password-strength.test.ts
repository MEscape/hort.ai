import { describe, expect, it } from 'vitest';

import { suggestEmailDomain } from '@modules/auth/presentation/forms/suggest-email-domain';
import { STRENGTH, assessPassword } from '@modules/auth/presentation/password/password-strength';

describe('local password guidance', () => {
  it('starts empty and never rates a short or common password above weak', () => {
    expect(assessPassword('').level).toBe(STRENGTH.none);
    for (const value of ['tiny', 'password123456', 'aaaaaaaaaaaaaa', 'qwertyuiopasdfghjkl']) {
      expect(assessPassword(value).level).toBe(STRENGTH.weak);
    }
  });

  it('recognizes long passphrases without requiring a special character', () => {
    expect(assessPassword('otter lantern velvet mountain').level).toBe(STRENGTH.strong);
    expect(assessPassword('otter lantern velvet mountain').avoidsPersonalInfo).toBeNull();
  });

  it('warns when the password includes the parent’s own details', () => {
    const assessment = assessPassword('Alex and many other random words', [
      'Alex',
      'alex@example.test',
    ]);
    expect(assessment.avoidsPersonalInfo).toBe(false);
    expect(assessment.level).toBeLessThanOrEqual(STRENGTH.fair);
    expect(assessment.isLongEnough).toBe(true);
  });

  it('reads names with umlauts as whole words', () => {
    expect(
      assessPassword('Müller and many other words', ['Jürgen Müller']).avoidsPersonalInfo,
    ).toBe(false);
    expect(assessPassword('Keller zeller cellar words', ['Jürgen Müller']).avoidsPersonalInfo).toBe(
      true,
    );
  });
});

describe('email typo suggestions', () => {
  it.each([
    ['alex@gmial.com', 'alex@gmail.com'],
    ['alex@gmai.com', 'alex@gmail.com'],
    ['alex@gmaill.com', 'alex@gmail.com'],
    ['alex@gmaik.com', 'alex@gmail.com'],
  ])('offers a correction for %s', (input, expected) => {
    expect(suggestEmailDomain(input)).toBe(expected);
  });

  it.each(['alex@gmail.com', 'alex@school.example', 'not-an-address', 'alex@', '@gmail.com'])(
    'leaves a valid custom domain or incomplete input alone (%s)',
    (input) => {
      expect(suggestEmailDomain(input)).toBeNull();
    },
  );
});
