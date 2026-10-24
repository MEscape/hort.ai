import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { AuthFormSkeleton } from '@modules/auth/presentation/components/auth-form-skeleton';

import { renderAuth } from './render-auth';

it('renders a translated busy route fallback using the supplied client catalog', () => {
  renderAuth(<AuthFormSkeleton />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading…');
});
