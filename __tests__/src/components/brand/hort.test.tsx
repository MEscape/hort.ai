import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Hort } from '@components/brand/hort';

import { APP_IDENTITY } from '@lib/config';

const artwork = readFileSync(join(process.cwd(), 'public', APP_IDENTITY.assets.owl), 'utf8');

describe('Hort the owl', () => {
  it.each(['hello', 'think', 'happy', 'oops', 'mail'] as const)(
    'renders the %s expression from the canonical artwork',
    (mood) => {
      render(<Hort label="Learning companion" mood={mood} />);
      const image = screen.getByRole('img', { name: 'Learning companion' });
      expect(image).toHaveAttribute('data-mood', mood);
      expect(image.querySelector(`use[href$="#face-${mood}"]`)).not.toBeNull();
      expect(artwork).toContain(`id="face-${mood}"`);
      expect(
        image.querySelector(`use[href$="#${mood === 'mail' ? 'letter' : 'book'}"]`),
      ).not.toBeNull();
    },
  );

  it('is decorative by default and opts into the existing motion preference system', () => {
    const { container, rerender } = render(<Hort />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).not.toHaveClass('animate-float');
    rerender(<Hort isAmbient />);
    expect(container.querySelector('svg')).toHaveClass('animate-float');
  });
});
