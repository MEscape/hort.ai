import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Lumi } from '@components/brand/lumi';

import { APP_IDENTITY } from '@lib/config';

const artwork = readFileSync(join(process.cwd(), 'public', APP_IDENTITY.assets.owl), 'utf8');

describe('Lumi the owl', () => {
  it.each(['hello', 'think', 'happy', 'oops', 'mail'] as const)(
    'renders the %s expression from the canonical artwork',
    (mood) => {
      render(<Lumi label="Learning companion" mood={mood} />);
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
    const { container, rerender } = render(<Lumi />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).not.toHaveClass('animate-float');
    rerender(<Lumi isAmbient />);
    expect(container.querySelector('svg')).toHaveClass('animate-float');
  });
});
