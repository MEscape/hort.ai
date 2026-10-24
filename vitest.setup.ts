import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `server-only` throws when imported outside a server bundle; tests run server code directly.
vi.mock('server-only', () => ({}));

afterEach(() => {
  cleanup();
});
