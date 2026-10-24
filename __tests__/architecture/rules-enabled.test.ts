import { describe, expect, it } from 'vitest';

import { architectureRules } from '../../eslint/config/architecture.mjs';
import plugin from '../../eslint/plugins/architecture/index.mjs';

describe('the architecture rules', () => {
  it('are all switched on', () => {
    const enabled = new Set(
      (architectureRules as Array<{ rules?: Record<string, unknown> }>).flatMap((block) =>
        Object.keys(block.rules ?? {}),
      ),
    );
    const missing = Object.keys(plugin.rules).filter(
      (name) => !enabled.has(`architecture/${name}`),
    );

    expect(missing, 'add these to eslint/config/architecture.mjs').toEqual([]);
  });
});
