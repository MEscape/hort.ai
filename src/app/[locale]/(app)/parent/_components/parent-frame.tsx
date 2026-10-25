import type { ReactNode } from 'react';

import {
  ReturnToChildButton,
  SignOutButton,
  getParentAreaServices,
  isAuthEnabled,
  requireSignedIn,
} from '@modules/auth';
import { ParentDashboard, requireOnboarded } from '@modules/learner';
import type { ChildProfileDto, ParentRange, ParentSection } from '@modules/learner';

import { systemClock } from '@lib/clock';
import { escalate } from '@lib/errors/escalate';

import { ParentGate } from './parent-gate';

/**
 * The server gate every parent page passes: signed in, then the short-lived password proof, and
 * only then the child profile. Without the proof nothing about the child is loaded.
 */
export async function ParentFrame({
  section,
  range,
  children,
}: {
  readonly section: ParentSection;
  readonly range: ParentRange;
  readonly children: (child: ChildProfileDto) => ReactNode;
}) {
  await requireSignedIn('/parent');
  const access = await getParentAreaServices().require.execute();
  if (access.isErr()) {
    if (access.error.kind === 'infrastructure') {
      escalate(access.error);
    }
    return <ParentGate />;
  }
  const child = await requireOnboarded();
  return (
    <ParentDashboard
      name={child.displayName}
      section={section}
      range={range}
      updatedAt={systemClock.now().toISOString()}
      actions={
        <>
          <ReturnToChildButton />
          {isAuthEnabled && <SignOutButton />}
        </>
      }
    >
      {children(child)}
    </ParentDashboard>
  );
}
