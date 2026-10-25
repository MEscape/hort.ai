import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader, PageMain, PageShell } from '@components/layout/layout-primitives';

describe('page layout primitives', () => {
  it('frame a page as a banner above a main landmark, so a screen reader can jump to either', () => {
    render(
      <PageShell>
        <PageHeader>Logo</PageHeader>
        <PageMain>Content</PageMain>
      </PageShell>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('Logo');
    expect(screen.getByRole('main')).toHaveTextContent('Content');
  });

  it('keeps a panel inside one readable column, with room above it for Hort on its edge', () => {
    render(<PageMain variant="panel">Card</PageMain>);

    const column = screen.getByText('Card');
    expect(column).toHaveClass('w-full', 'max-w-lg');
    expect(screen.getByRole('main')).toHaveClass('pt-24');
  });

  it('centers a lone panel such as an error in the full height of the window', () => {
    render(<PageMain variant="centered">Oops</PageMain>);

    expect(screen.getByRole('main')).toHaveClass('min-h-dvh', 'items-center');
  });

  it('passes a class through, so a caller can adjust spacing without a new primitive', () => {
    render(<PageHeader className="extra">Logo</PageHeader>);

    expect(screen.getByRole('banner')).toHaveClass('extra');
  });
});
