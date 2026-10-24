import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import type { LearnerDependencies } from '@modules/learner/application/learner-dependencies';
import type { ChildProfile } from '@modules/learner/domain/models/child-profile';
import {
  toActorId,
  toChildProfileId,
  toTenantId,
  toTutorId,
} from '@modules/learner/domain/models/ids';
import type { ChildProfileId } from '@modules/learner/domain/models/ids';
import { DEFAULT_CONTROLS } from '@modules/learner/domain/models/parent-controls';
import { SETUP_STEPS } from '@modules/learner/domain/models/setup-step';
import type { SetupStep } from '@modules/learner/domain/models/setup-step';
import type {
  ChildProfileRepository,
  ProfilePatch,
  SavedProfile,
  UnfinishedProfileInput,
} from '@modules/learner/domain/ports/child-profile.repository';
import type {
  LearnerAuditLog,
  LearnerEvent,
} from '@modules/learner/domain/ports/learner-audit-log.port';
import type { TutorCatalogPort } from '@modules/learner/domain/ports/tutor-catalog.port';

import type { Clock } from '@lib/clock';
import { okAsync } from '@lib/result';

import { parent, recordingAudit, signedInAs } from '../auth/fakes';

export const NOW = new Date('2026-10-24T12:00:00.000Z');

export const PARENT_A = parent();
export const PARENT_B = parent({ id: toActorId('parent-2') });

export const MAX = toTutorId('max');

export const DETAILS = { displayName: 'Lisa', federalState: 'BY', grade: 2 } as const;

/** A stored profile of parent A; override what a test is about. */
export function profileOf(
  overrides: Omit<Partial<ChildProfile>, 'id'> & { id?: string } = {},
): ChildProfile {
  const { id = 'profile-1', ...rest } = overrides;
  return {
    id: toChildProfileId(id),
    tenantId: toTenantId('default'),
    ownerId: toActorId('parent-1'),
    displayName: 'Lisa',
    federalState: 'BY',
    grade: 2,
    interests: [],
    tutorId: null,
    controls: DEFAULT_CONTROLS,
    guardian: null,
    setupStep:
      rest.setupCompletedAt === undefined || rest.setupCompletedAt === null ? 'interests' : 'done',
    setupCompletedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...rest,
  };
}

/**
 * The repository's contract in memory: owner-scoped reads, at most one unfinished profile per
 * parent, and a conditional completion that only one call can win. `writes` counts the calls that
 * changed something, so a test can assert that an idempotent call wrote nothing.
 */
export class InMemoryChildProfiles implements ChildProfileRepository {
  readonly rows: ChildProfile[] = [];
  writes = 0;
  private sequence = 0;

  constructor(...initial: ChildProfile[]) {
    this.rows.push(...initial);
  }

  findOwned(id: ChildProfileId, ownerId: Actor['id'], tenantId: Actor['tenantId']) {
    const found = this.rows.find(
      (row) => row.id === id && row.ownerId === ownerId && row.tenantId === tenantId,
    );
    return okAsync(found ?? null);
  }

  listByOwner(ownerId: Actor['id'], tenantId: Actor['tenantId'], limit: number) {
    return okAsync(
      this.rows
        .filter((row) => row.ownerId === ownerId && row.tenantId === tenantId)
        .slice(0, limit),
    );
  }

  saveUnfinished(input: UnfinishedProfileInput) {
    const index = this.rows.findIndex(
      (row) =>
        row.ownerId === input.ownerId &&
        row.tenantId === input.tenantId &&
        row.setupCompletedAt === null,
    );
    const existing = this.rows[index];
    this.writes += 1;
    let saved: SavedProfile;
    if (existing === undefined) {
      this.sequence += 1;
      const profile = profileOf({
        id: `new-${this.sequence}`,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        ...input.details,
      });
      this.rows.push(profile);
      saved = { profile, isNew: true };
    } else {
      const profile = { ...existing, ...input.details };
      this.rows[index] = profile;
      saved = { profile, isNew: false };
    }
    return okAsync<SavedProfile | null>(saved);
  }

  updateUnfinished(
    profile: ChildProfile,
    patch: ProfilePatch,
    reaches: Exclude<SetupStep, 'child' | 'done'>,
  ) {
    const index = this.rows.findIndex(
      (row) =>
        row.id === profile.id &&
        row.ownerId === profile.ownerId &&
        row.tenantId === profile.tenantId &&
        row.setupCompletedAt === null,
    );
    const stored = this.rows[index];
    if (stored === undefined) {
      return okAsync<ChildProfile | null>(null);
    }
    this.writes += 1;
    // Same rule as the real adapter: the step only ever moves forward.
    const furthest = Math.max(SETUP_STEPS.indexOf(stored.setupStep), SETUP_STEPS.indexOf(reaches));
    const updated: ChildProfile = {
      ...stored,
      ...patch,
      setupStep: SETUP_STEPS[furthest] ?? reaches,
    };
    this.rows[index] = updated;
    return okAsync<ChildProfile | null>(updated);
  }

  markSetupCompleted(profile: ChildProfile, completedAt: Date) {
    const index = this.rows.findIndex((row) => row.id === profile.id);
    const stored = this.rows[index];
    if (stored?.setupCompletedAt !== null || stored.setupStep !== 'review') {
      return okAsync(false);
    }
    this.writes += 1;
    this.rows[index] = { ...stored, setupStep: 'done', setupCompletedAt: completedAt };
    return okAsync(true);
  }
}

/** The tutor catalog as the use cases see it: the given ids are the ones a parent may choose. */
export function selectableTutors(...ids: string[]): TutorCatalogPort {
  return { isSelectable: (id) => ids.includes(id) };
}

export function recordingLearnerAudit(): LearnerAuditLog & { readonly events: LearnerEvent[] } {
  const events: LearnerEvent[] = [];
  return {
    events,
    record: (event) => {
      events.push(event);
    },
  };
}

/** Everything a learner use case needs, with the signed-in parent chosen by the test. */
export function build(actor: Actor = PARENT_A, ...initial: ChildProfile[]) {
  const childProfiles = new InMemoryChildProfiles(...initial);
  const audit = recordingLearnerAudit();
  const securityAudit = recordingAudit();
  const clock: Clock = { now: () => NOW };
  const deps: LearnerDependencies = {
    authorization: createAuthorizationService({
      currentActor: signedInAs(actor),
      audit: securityAudit,
    }),
    childProfiles,
    audit,
    tutors: selectableTutors('max', 'lili', 'fina'),
    clock,
  };
  return { deps, childProfiles, audit, securityAudit };
}
