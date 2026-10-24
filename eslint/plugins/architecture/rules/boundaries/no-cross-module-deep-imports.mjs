import { isPublicApiOf } from '../../../../policy/paths.mjs';
import {
  classifyContext,
  defineRule,
  moduleSpecifierVisitors,
  report,
  resolveFrom,
} from '../../util.mjs';

/** Another module's internals are off limits for imports, re-exports, dynamic imports and type imports alike. */
export const noCrossModuleDeepImports = defineRule({
  description:
    "Forbid reaching into another module's domain/application/infrastructure/presentation/composition; use its public API ('@modules/<name>').",
  create(context) {
    const { repoPath, file } = classifyContext(context);
    return moduleSpecifierVisitors(({ node, specifier }) => {
      const target = resolveFrom(repoPath, specifier);
      if (target.kind !== 'internal' || target.area !== 'module') return;
      if (file.area === 'module' && file.module === target.module) return;
      if (isPublicApiOf(target)) return;
      const inner = target.path.split('/').slice(3).join('/');
      report(
        context,
        node,
        `Deep import into module '${target.module}' ('${inner}'). Import from '@modules/${target.module}' (its public API) instead; if it is not exported there, the module has not decided to share it.`,
      );
    });
  },
});
