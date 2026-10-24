import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from '@components/ui/card';

describe('Card', () => {
  it('shows a visual container without implying button interaction', () => {
    render(
      <Card tone="highlight">
        <h2>Discover</h2>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Discover' }).parentElement).toHaveClass(
      'bg-highlight',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
