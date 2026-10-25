import { deAssignments as assignments } from '@modules/assignments';
import { deAuth as auth } from '@modules/auth';
import { deClassroom as classroom } from '@modules/classroom';
import { deGuidance as guidance } from '@modules/guidance';
import { deLearner as learner } from '@modules/learner';
import { deLesson as lesson } from '@modules/lesson';
import { deProgression as progression } from '@modules/progression';
import { deTeacherMaterial as teacherMaterial } from '@modules/teacher-material';
import { deVoice as voice } from '@modules/voice';

import deApp from '../messages/de.json';

import type { MessageCatalog, TranslationSchema } from '../config';

/**
 * The German catalog:
 * Statically verified against the English `MessageCatalog` schema via `satisfies`.
 * Any missing, extra, or structurally mismatched key in `de.json` or any module's
 * German bundle will fail TypeScript compilation immediately.
 */
const messages = {
  app: deApp,
  assignments: assignments.assignments,
  auth: auth.auth,
  classroom: classroom.classroom,
  guidance: guidance.guidance,
  learner: learner.learner,
  lesson: lesson.lesson,
  progression: progression.progression,
  teacherMaterial: teacherMaterial.teacherMaterial,
  voice: voice.voice,
} as const satisfies TranslationSchema<MessageCatalog>;

export default messages;
