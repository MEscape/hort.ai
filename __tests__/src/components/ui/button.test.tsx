import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@components/ui/button';

describe('Button', () => {
  it('defaults to a non-submitting button with a clear accessible name', () => {
    render(<Button>Continue</Button>);

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
  });

  it('uses the selected semantic token variant', () => {
    render(<Button variant="accent">Hint</Button>);

    expect(screen.getByRole('button', { name: 'Hint' })).toHaveClass('bg-accent');
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute('data-variant', 'accent');
  });

  it('does not activate a disabled button', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Coming soon
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Coming soon' }));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
