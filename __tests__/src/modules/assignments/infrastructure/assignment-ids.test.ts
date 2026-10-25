import { describe, expect, it } from 'vitest';

import { parseAssignmentId, parseClassroomId } from '@modules/assignments/domain/models/ids';

for (const [name, parse] of Object.entries({
  assignment: parseAssignmentId,
  classroom: parseClassroomId,
})) {
  describe(`${name} identifiers`, () => {
    it('brands a bounded nonempty identifier', () => {
      expect(parse('stored-id').isOk()).toBe(true);
      expect(parse('x'.repeat(128)).isOk()).toBe(true);
    });

    it('rejects empty or oversized input', () => {
      expect(parse('').isErr()).toBe(true);
      expect(parse('x'.repeat(129)).isErr()).toBe(true);
    });
  });
}
