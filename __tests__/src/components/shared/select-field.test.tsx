import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SelectField } from '@components/shared/select-field';

const OPTIONS = [
  { value: 'BY', label: 'Bavaria' },
  { value: 'BE', label: 'Berlin' },
];

function field(value: string) {
  return (
    <SelectField
      id="state"
      label="Federal state"
      placeholder="Choose a federal state"
      options={OPTIONS}
      value={value}
      onValueChange={() => undefined}
    />
  );
}

describe('SelectField', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the placeholder while nothing is chosen', () => {
    render(field(''));

    expect(screen.getByRole('combobox', { name: 'Federal state' })).toHaveTextContent(
      'Choose a federal state',
    );
  });

  it('stays controlled from the empty value to the first choice', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { rerender } = render(field(''));

    rerender(field('BY'));

    expect(screen.getByRole('combobox', { name: 'Federal state' })).toHaveTextContent('Bavaria');
    const messages = [...consoleError.mock.calls, ...consoleWarn.mock.calls].flat().join(' ');
    expect(messages).not.toMatch(/uncontrolled to controlled/);
  });
});
