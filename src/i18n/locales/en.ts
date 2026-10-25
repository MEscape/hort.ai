import { enAssignments as assignments } from '@modules/assignments';
import { enAuth as auth } from '@modules/auth';
import { enClassroom as classroom } from '@modules/classroom';
import { enLearner as learner } from '@modules/learner';
import { enProgression as progression } from '@modules/progression';
import { enTeacherMaterial as teacherMaterial } from '@modules/teacher-material';

import enApp from '../messages/en.json';

/**
 * The English catalog (source of truth for schema & types):
 * The app shell's own namespace plus one namespace per module, each owned
 * and completed by its module. Nothing is merged across namespaces, so a
 * module's message map can only point at keys it owns.
 */
const messages = {
  app: enApp,
  assignments: assignments.assignments,
  auth: auth.auth,
  classroom: classroom.classroom,
  learner: learner.learner,
  progression: progression.progression,
  teacherMaterial: teacherMaterial.teacherMaterial,
} as const;

export default messages;
