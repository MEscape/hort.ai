import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseEnv } from '@lib/config/parse-env';

const schema = z.object({
  PORT: z.coerce.number().int().min(1),
  API_KEY: z.string().min(40),
});

const ROOT = z.string().refine(() => false, { error: 'nope' });

describe('parseEnv', () => {
  it('returns the parsed value', () => {
    const key = 'k'.repeat(40);
    expect(parseEnv('server', schema, { PORT: '80', API_KEY: key })).toEqual({
      PORT: 80,
      API_KEY: key,
    });
  });

  it('throws one error naming every failed variable and the label', () => {
    expect(() => parseEnv('public', schema, { PORT: '0', API_KEY: 'x' })).toThrow(
      /^Invalid public environment configuration:\n {2}- PORT: .+\n {2}- API_KEY: .+$/,
    );
  });

  it('never prints the offending values', () => {
    const secret = 'super-secret-value';
    let message = '';
    try {
      parseEnv('server', schema, { PORT: 'port-secret-1', API_KEY: secret });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('API_KEY');
    expect(message).not.toContain(secret);
    expect(message).not.toContain('port-secret-1');
  });

  it('names a problem without a path as the configuration itself', () => {
    expect(() => parseEnv('server', ROOT, 'anything')).toThrow(
      'Invalid server environment configuration:\n  - (configuration): nope',
    );
  });
});
