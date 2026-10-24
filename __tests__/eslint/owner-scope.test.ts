import { createOwnerScopeRule } from '../../eslint/plugins/architecture/rules/adapters/owner-scope.mjs';

import { invalid, ruleTester, valid } from './rule-tester';

const REPO = 'src/modules/learning/infrastructure/prisma/prisma-lesson.repository.ts';
const OUTSIDE = 'src/modules/learning/application/commands/x.ts';

const UNBOUND = /is not bound to its owner/;
const KIND_AND_REASON = /needs a kind .* and a one-line reason/;

/** A class around the statement, as a repository has. */
const method = (body: string, comment = '') =>
  `export class Repo {\n  ${comment}\n  find(id, ownerId) {\n    return ${body};\n  }\n}`;

const testOwnership = {
  columns: ['ownerId'],
  tag: 'owner-scope',
  tables: {
    Lesson: { pins: ['ownerId'] },
    Profile: { pins: ['ownerId', 'id'] },
    Attempt: { pins: [], via: 'Lesson' },
  },
};

const ownerScopeRule = createOwnerScopeRule(() => testOwnership);

ruleTester.run('architecture/owner-scope', ownerScopeRule, {
  valid: [
    // Pinned by an owner column of the table.
    valid(REPO, method('db.orm.public.Lesson.where({ id, ownerId }).first()')),
    valid(REPO, method('tx.orm.public.Lesson.where({ ownerId }).all()')),
    // Profile is its own owner: its id pins it.
    valid(REPO, method('db.orm.public.Profile.where({ id }).first()')),
    valid(REPO, method('db.orm.public.Profile.where((profile) => profile.id.in(ids)).all()')),
    // Pinned through a relation, for a table owned through a parent.
    valid(
      REPO,
      method('db.orm.public.Attempt.where((attempt) => attempt.lesson.some({ ownerId })).first()'),
    ),
    // Pinned further along the chain, and by a constant.
    valid(REPO, method('db.orm.public.Lesson.select("id").where({ ownerId }).limit(1).all()')),
    // A write that names its owner.
    valid(REPO, method('db.orm.public.Lesson.create({ ownerId, title })')),
    valid(
      REPO,
      method('db.orm.public.Attempt.createAll([{ lessonId, ownerId }, { lessonId, ownerId }])'),
    ),
    valid(
      REPO,
      method(
        'db.orm.public.Lesson.upsert({ create: { ownerId, title }, update: {}, conflictOn: { id } })',
      ),
    ),
    // Said instead, with a kind and a reason: on the statement, the method or the helper.
    valid(
      REPO,
      method(
        'db.orm.public.Profile.where({ actorId }).all()',
        '/** @owner-scope actor Bound to the person, not an owner. */',
      ),
    ),
    valid(
      REPO,
      `export class Repo {\n  find(id) {\n    // @owner-scope derived The id was read by a pinned query just above.\n    const row = db.orm.public.Attempt.where({ lessonId: id }).first();\n    return row;\n  }\n}`,
    ),
    valid(
      REPO,
      `// @owner-scope builder Every caller pins it.\nconst lessons = () => db.orm.public.Lesson.select('id');\nexport class Repo {\n  find(id, ownerId) {\n    return lessons().where({ id, ownerId }).first();\n  }\n}`,
    ),
    // A table that is not owned, and code that is not a repository.
    valid(REPO, method('db.orm.public.GlobalConfig.where({ id }).first()')),
    valid(OUTSIDE, method('db.orm.public.Lesson.where({ id }).first()')),
    // Raw statements that bind an owner, or name no owned table.
    valid(REPO, method('db.raw.sql`SELECT 1 FROM "Lesson" WHERE "ownerId" = ${ownerId}`.build()')),
    valid(REPO, method('db.raw.sql`SELECT pg_advisory_xact_lock(${key})`.build()')),
  ],
  invalid: [
    invalid(REPO, method('db.orm.public.Lesson.where({ id }).first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Profile.where({ slug }).first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Lesson.select("id").first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Lesson.where({ id }).update({ status })'), UNBOUND),
    invalid(REPO, method('db.orm.public.Lesson.where({ id }).deleteAndCount()'), UNBOUND),
    // A pin that may be missing is no pin: the spread can add nothing.
    invalid(
      REPO,
      method('db.orm.public.Lesson.where({ ...(ownerId === null ? {} : { ownerId }) }).all()'),
      UNBOUND,
    ),
    // A column of another table, and a callback that names none.
    invalid(REPO, method('db.orm.public.Lesson.where({ categoryId }).all()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Lesson.where((b) => b.status.eq(x)).all()'), UNBOUND),
    // A table owned through a parent is not pinned by its own id.
    invalid(REPO, method('db.orm.public.Attempt.where({ id }).first()'), UNBOUND),
    // Writes whose owner cannot be seen.
    invalid(REPO, method('db.orm.public.Lesson.create(row)'), UNBOUND),
    invalid(REPO, method('db.orm.public.Attempt.createAll(rows)'), UNBOUND),
    invalid(REPO, method('db.orm.public.Attempt.createAll([{ lessonId }])'), UNBOUND),
    // A tag that gives no reason or no kind is not a reason.
    invalid(
      REPO,
      method('db.orm.public.Lesson.where({ id }).first()', '/** @owner-scope derived */'),
      KIND_AND_REASON,
    ),
    invalid(
      REPO,
      method('db.orm.public.Lesson.where({ id }).first()', '/** @owner-scope whatever Because. */'),
      KIND_AND_REASON,
    ),
    // A tagged builder only moves the question to its callers.
    invalid(
      REPO,
      `// @owner-scope builder Every caller pins it.\nconst lessons = () => db.orm.public.Lesson.select('id');\nexport class Repo {\n  find(id) {\n    return lessons().where({ id }).first();\n  }\n}`,
      UNBOUND,
    ),
    // A comment on another method covers nothing here.
    invalid(
      REPO,
      `export class Repo {\n  /** @owner-scope actor Bound to the person. */\n  mine(actorId) {\n    return db.orm.public.Profile.where({ actorId }).all();\n  }\n  find(id) {\n    return db.orm.public.Lesson.where({ id }).first();\n  }\n}`,
      UNBOUND,
    ),
    // Raw SQL on an owned table without its owner.
    invalid(
      REPO,
      method('db.raw.sql`SELECT * FROM "Lesson" WHERE "id" = ${id}`.build()'),
      /raw statement on an owned table/,
    ),
  ],
});
