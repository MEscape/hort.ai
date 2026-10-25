import { describe, expect, it, vi } from 'vitest';

import { GetAssignmentById } from '@modules/assignments/application/queries/get-assignment-by-id';

import { okAsync } from '@lib/result';

import { parent } from '../../auth/fakes';
import { createWorld } from '../fakes';

function setup(teacher: boolean) {
  const actor = parent({ roles: [teacher ? 'teacher' : 'parent'] });
  const findById = vi.fn(() => okAsync(null));
  const world = createWorld();
  return {
    actor,
    findById,
    query: new GetAssignmentById({
      ...world.dependenciesFor(actor),
      assignments: { ...world.repository, findById },
    }),
  };
}

describe('GetAssignmentById', () => {
  it('refuses parents before touching persistence', async () => {
    const { query, findById } = setup(false);
    const result = await query.execute('assignment');
    expect(result.isErr() && result.error.code).toBe('auth.permission_denied');
    expect(findById).not.toHaveBeenCalled();
  });

  it('binds a teacher read to the server actor rather than request scope', async () => {
    const { query, findById, actor } = setup(true);
    expect((await query.execute('assignment')).isOk()).toBe(true);
    expect(findById).toHaveBeenCalledWith('assignment', {
      tenantId: actor.tenantId,
      ownerId: actor.id,
    });
  });

  it('rejects malformed ids before querying storage', async () => {
    const { query, findById } = setup(true);
    expect((await query.execute('')).isErr()).toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });
});
