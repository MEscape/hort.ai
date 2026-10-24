import {
  classifyContext,
  defineRule,
  moduleSpecifierVisitors,
  report,
  resolveFrom,
} from '../../util.mjs';

/** What an application folder may not import: the folders that call it, or that sit beside it as a peer. */
const FORBIDDEN_BY_DIR = {
  services: {
    folders: ['commands', 'queries'],
    why: 'A service helps a use case do its work; a use case calls services, never the other way. Move the shared piece into the service, or pass what it needs in.',
  },
  queries: {
    folders: ['commands'],
    why: 'A query only reads. If it needs something a command does, the shared part belongs in application/services.',
  },
};

/**
 * Inside `application/` the calls go one way: commands and queries call `services`; a service never calls a
 * command or a query, and a query never calls a command. A service that reaches back into a use case is a
 * use case in disguise.
 */
export const applicationFlow = defineRule({
  description:
    'application/services never import commands or queries, and queries never import commands.',
  create(context) {
    const { repoPath, file } = classifyContext(context);
    const rule =
      file.area === 'module' && file.layer === 'application'
        ? FORBIDDEN_BY_DIR[file.dir]
        : undefined;
    if (rule === undefined) return {};

    return moduleSpecifierVisitors(({ node, specifier }) => {
      if (!specifier.startsWith('.')) return;
      const target = resolveFrom(repoPath, specifier);
      if (
        target.kind === 'internal' &&
        target.module === file.module &&
        target.layer === 'application' &&
        rule.folders.includes(target.dir)
      ) {
        report(
          context,
          node,
          `application/${file.dir} must not import application/${target.dir}. ${rule.why}`,
        );
      }
    });
  },
});
