import type { AuthorizationService } from '@modules/auth';

import type { ChildAccessPort } from '../domain/ports/child-access.port';
import type { ChildSafetyPort } from '../domain/ports/child-safety.port';
import type { OpenTaskPort } from '../domain/ports/open-task.port';

/** What every lesson use case is built from. */
export interface LessonDependencies {
  readonly authorization: AuthorizationService;
  readonly children: ChildAccessPort;
  readonly safety: ChildSafetyPort;
  readonly tasks: OpenTaskPort;
}
