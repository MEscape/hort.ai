import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedbackPanel } from '@components/shared/feedback-panel';

describe('FeedbackPanel', () => {
  it('provides reassuring copy with a dedicated nudge style', () => {
    const { container } = render(
      <FeedbackPanel tone="nudge" title="Let's count again">
        Try one apple at a time.
      </FeedbackPanel>,
    );

    expect(screen.getByText("Let's count again")).toBeVisible();
    expect(screen.getByText('Try one apple at a time.')).toBeVisible();
    expect(container.firstElementChild).toHaveClass('bg-nudge-subtle');
    expect(container.firstElementChild).not.toHaveClass('bg-danger-subtle');
  });
});
