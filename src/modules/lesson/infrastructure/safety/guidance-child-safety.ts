import { detectsChildDistress } from '@modules/guidance';

import type { ChildSafetyPort } from '../../domain/ports/child-safety.port';

/** The guidance module's #90 check, through its public API: one list of distress patterns for the app. */
export const guidanceChildSafety: ChildSafetyPort = {
  detectsDistress: detectsChildDistress,
};
