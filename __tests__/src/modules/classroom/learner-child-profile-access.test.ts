import { describe, expect, it, vi } from 'vitest';

import { LearnerChildProfileAccess } from '@modules/classroom/infrastructure/learner/learner-child-profile-access';
import type { ChildProfileView } from '@modules/learner';

import { okAsync } from '@lib/result';

describe('LearnerChildProfileAccess', () => {
  it("hands the class's federal state to the learner module in its upper-case vocabulary", async () => {
    const adoptSchoolSettings = { execute: vi.fn(() => okAsync({} as ChildProfileView)) };
    const access = new LearnerChildProfileAccess({
      getChildProfileById: { execute: () => okAsync({} as ChildProfileView) },
      adoptSchoolSettings,
    });

    const result = await access.adoptClassroomSettings('child-1', { federalState: 'he', grade: 3 });

    expect(result.isOk()).toBe(true);
    expect(adoptSchoolSettings.execute).toHaveBeenCalledWith({
      profileId: 'child-1',
      federalState: 'HE',
      grade: 3,
    });
  });
});
