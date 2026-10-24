/**
 * Dependency checks over the whole tree. They deliberately re-derive their
 * answers from the source instead of trusting the lint run, so a file that
 * is ignored, or a rule that is disabled with a comment, is still caught.
 */
import { checkLayerImport } from '../plugins/architecture/rules/boundaries/layer-imports.mjs';

import { portImplementations } from './checks-structure.mjs';
import { isPublicApiOf, resolveSpecifier } from './paths.mjs';
import { KNOWN_MODULE_CYCLES, SERVER_ONLY_SPECIFIERS, policyFor } from './policy.mjs';
import { exportedNames, instantiatedClasses, topLevelClasses, violation } from './project.mjs';

/** Layer direction, shared-library allow-lists and the public-API contract for every import form. */
export function checkLayerDependencies(project) {
  const out = [];
  for (const file of project.files.values()) {
    for (const imp of file.imports) {
      const target = resolveSpecifier(file.path, imp.specifier);
      const message = checkLayerImport({
        repoPath: file.path,
        file: file.info,
        target,
        specifier: imp.specifier,
        isTypeOnly: imp.isTypeOnly,
        names: imp.names,
        root: project.root,
      });
      if (message) out.push(violation('layer-dependencies', `${file.path}:${imp.line}`, message));
    }
  }
  return out;
}

/** Deep imports into another module, and cyclic module dependencies. */
export function checkModuleGraph(project) {
  const out = [];
  const edges = new Map(project.modules.map((m) => [m, new Set()]));
  for (const file of project.files.values()) {
    for (const imp of file.imports) {
      const target = resolveSpecifier(file.path, imp.specifier);
      if (target.kind !== 'internal' || target.area !== 'module') continue;
      const from = file.info.area === 'module' ? file.info.module : null;
      if (from === target.module) continue;
      if (!isPublicApiOf(target)) {
        out.push(
          violation(
            'module-graph',
            `${file.path}:${imp.line}`,
            `Deep import into module '${target.module}' ('${imp.specifier}'). Use '@modules/${target.module}'.`,
          ),
        );
      }
      if (from !== null) edges.get(from)?.add(target.module);
    }
  }
  const state = new Map();
  const stack = [];
  const seenCycles = new Set();
  const known = new Map(KNOWN_MODULE_CYCLES.map((c) => [[...c.modules].sort().join(','), c]));
  const dfs = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (state.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join(',');
        seenCycles.add(key);
        if (!known.has(key))
          out.push(
            violation(
              'module-graph',
              `src/modules/${next}`,
              `Cyclic module dependency: ${[...cycle, next].join(
                ' → ',
              )}. Break it with a domain port in one of the modules.`,
            ),
          );
      } else if (!state.has(next)) dfs(next);
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const m of project.modules) if (!state.has(m)) dfs(m);
  for (const [key, cycle] of known) {
    if (!seenCycles.has(key))
      out.push(
        violation(
          'module-graph',
          'eslint/policy/policy.mjs',
          `KNOWN_MODULE_CYCLES lists ${cycle.modules.join(
            ' → ',
          )}, but that cycle no longer exists. Remove the entry.`,
        ),
      );
  }
  return out;
}

/** Prisma and the database client stay in infrastructure (and inside @lib/db itself). */
export function checkPrismaContainment(project) {
  const out = [];
  for (const file of project.files.values()) {
    const inLibDb = file.path.startsWith('src/lib/db/');
    const inInfrastructure = file.info.area === 'module' && file.info.layer === 'infrastructure';
    for (const imp of file.imports) {
      if (/^@prisma\//.test(imp.specifier) && !inLibDb) {
        out.push(
          violation(
            'prisma-boundary',
            `${file.path}:${imp.line}`,
            `'${imp.specifier}' may only be imported inside src/lib/db. Everything else uses the \`db\` client through '@lib/db'.`,
          ),
        );
      }
      const target = resolveSpecifier(file.path, imp.specifier);
      const isDbLib = target.kind === 'internal' && target.path.startsWith('src/lib/db');
      if (isDbLib && !inInfrastructure && !inLibDb && file.info.area !== 'lib') {
        out.push(
          violation(
            'prisma-boundary',
            `${file.path}:${imp.line}`,
            `'@lib/db' (the database client) may only be imported from a module's infrastructure layer, not from ${
              file.info.area === 'module' ? file.info.layer : file.info.area
            }.`,
          ),
        );
      }
    }
  }
  return out;
}

const isServerOnly = (imp, resolvedTarget) =>
  SERVER_ONLY_SPECIFIERS.some((p) => p.test(imp.specifier)) ||
  (resolvedTarget.kind === 'internal' &&
    resolvedTarget.area === 'module' &&
    (resolvedTarget.file === 'composition' || resolvedTarget.layer === 'infrastructure'));

/**
 * No Client Component may reach server-only code. Traverses runtime imports
 * from every 'use client' file and stops at 'use server' files, whose
 * imports are replaced by RPC stubs in the client bundle.
 */
export function checkClientServerBoundary(project) {
  const out = [];
  for (const entry of project.files.values()) {
    if (!entry.directives.has('use client')) continue;
    const seen = new Set([entry.path]);
    const queue = [[entry, [entry.path]]];
    while (queue.length > 0) {
      const [file, chain] = queue.shift();
      for (const imp of file.imports) {
        if (imp.isTypeOnly) continue;
        const target = resolveSpecifier(file.path, imp.specifier);
        if (isServerOnly(imp, target)) {
          out.push(
            violation(
              'client-server',
              entry.path,
              `Client Component reaches server-only code '${imp.specifier}' via ${[
                ...chain,
                file === entry ? '' : '',
              ]
                .filter(Boolean)
                .join(' → ')}. Call a Server Action instead.`,
            ),
          );
          continue;
        }
        const next = project.resolveFile(file.path, imp.specifier);
        if (!next || seen.has(next.path) || next.directives.has('use server')) continue;
        seen.add(next.path);
        if (next.imports.some((i) => /^server-only$/.test(i.specifier))) {
          out.push(
            violation(
              'client-server',
              entry.path,
              `Client Component reaches '${next.path}', which imports 'server-only' (via ${[
                ...chain,
                next.path,
              ].join(' → ')}).`,
            ),
          );
          continue;
        }
        queue.push([next, [...chain, next.path]]);
      }
    }
  }
  return out;
}

/** Composition roots wire every adapter and use case, and export only the use-case objects. */
export function checkCompositionWiring(project) {
  const out = [];
  for (const name of project.modules) {
    const policy = policyFor(name, project.root);
    const files = project.moduleFiles(name);
    const compositionPath = policy.compositionFile
      ? `src/modules/${name}/${policy.compositionFile}`
      : null;
    const composition = compositionPath ? project.files.get(compositionPath) : undefined;

    // every adapter that implements a domain port is constructed somewhere it can be used
    const everywhere = new Set();
    for (const f of files)
      if (f.path !== undefined)
        for (const n of instantiatedClasses(f)) everywhere.add(`${f.path}::${n}`);
    for (const impl of portImplementations(project, name)) {
      if (impl.kind === 'value') {
        // A ready-made adapter value is wired by importing it into composition.ts.
        const wired =
          composition !== undefined &&
          composition.imports.some(
            (i) =>
              i.names?.includes(impl.name) &&
              project.resolveFile(composition.path, i.specifier)?.path === impl.file.path,
          );
        if (!wired) {
          out.push(
            violation(
              'composition-wiring',
              impl.file.path,
              `\`${impl.name}\` is typed as ${impl.implemented.join(', ')} but composition.ts never imports it. An adapter that is not wired makes the port unusable (e.g. audit events silently dropped).`,
            ),
          );
        }
        continue;
      }
      const others = files.filter((f) => f.path !== impl.file.path);
      const inComposition =
        composition !== undefined && instantiatedClasses(composition).has(impl.name);
      // Adapters may also be built by a sibling adapter (a connector owning its credential provider), or exported as a
      // singleton from their own file that composition imports. What is never acceptable is: constructed nowhere.
      const inSibling = others.some(
        (f) => f.local.startsWith('infrastructure/') && instantiatedClasses(f).has(impl.name),
      );
      const singleton =
        instantiatedClasses(impl.file).has(impl.name) &&
        composition !== undefined &&
        composition.imports.some(
          (i) => project.resolveFile(composition.path, i.specifier)?.path === impl.file.path,
        );
      const constructed = inComposition || inSibling || singleton;
      if (!constructed) {
        const where = 'composition.ts (or an adapter that composition wires)';
        out.push(
          violation(
            'composition-wiring',
            impl.file.path,
            `\`${impl.name}\` implements ${impl.implemented.join(
              ', ',
            )} but is never constructed in ${where}. An adapter that is not wired makes the port unusable (e.g. audit events silently dropped).`,
          ),
        );
      }
    }

    if (!policy.role.requireComposition || !composition) continue;
    const built = instantiatedClasses(composition);
    for (const f of files.filter((x) => /^application\/(?:commands|queries)\//.test(x.local))) {
      for (const cls of topLevelClasses(f)) {
        if (!built.has(cls.name))
          out.push(
            violation(
              'composition-wiring',
              f.path,
              `Use case \`${cls.name}\` is not constructed in composition.ts, so nothing can call it.`,
            ),
          );
      }
    }
    if (!composition.imports.some((i) => i.specifier === 'server-only' && i.kind === 'import')) {
      out.push(
        violation(
          'composition-wiring',
          composition.path,
          "composition.ts must `import 'server-only'` so a Client Component import fails the build.",
        ),
      );
    }
    const publicNames = new Set(
      ['index.ts', 'client.ts'].flatMap((e) =>
        project.files.get(`src/modules/${name}/${e}`)
          ? exportedNames(project.files.get(`src/modules/${name}/${e}`))
          : [],
      ),
    );
    for (const exported of exportedNames(composition)) {
      // A name the public API deliberately re-exports (a use-case function, a route handler) is an intentional export.
      if (publicNames.has(exported)) continue;
      // `<module>Commands` / `<module>Queries`, or the lazy form `get<Module>Commands()` for modules whose wiring needs runtime configuration.
      if (
        !/^(?:[a-z][A-Za-z0-9]*(?:Commands|Queries)|get[A-Z][A-Za-z0-9]*(?:Commands|Queries))$/.test(
          exported,
        )
      ) {
        out.push(
          violation(
            'composition-wiring',
            composition.path,
            `composition.ts exports '${exported}'. It exports only the use-case objects (<module>Commands / <module>Queries, or get<Module>Commands()), never repositories or adapters.`,
          ),
        );
      }
    }
  }
  return out;
}

/** index.ts and client.ts expose explicit names that come from approved sources only. */
export function checkPublicApi(project) {
  const out = [];
  for (const name of project.modules) {
    const policy = policyFor(name, project.root);
    for (const [entry, sources] of [
      ['index.ts', policy.publicApiSources],
      ['client.ts', policy.clientApiSources],
    ]) {
      const file = project.files.get(`src/modules/${name}/${entry}`);
      if (!file) continue;
      for (const imp of file.imports) {
        if (imp.kind === 'export-all')
          out.push(
            violation(
              'public-api',
              file.path,
              `'export * from ${imp.specifier}' exposes everything. Re-export named members.`,
            ),
          );
        const target = resolveSpecifier(file.path, imp.specifier);
        if (target.kind !== 'internal') continue;
        const inner = target.path.split('/').slice(3).join('/');
        const allowed = sources.some((prefix) =>
          prefix.endsWith('/') ? inner.startsWith(prefix) : inner === prefix,
        );
        if (!allowed)
          out.push(
            violation(
              'public-api',
              `${file.path}:${imp.line}`,
              `'${inner}' is not an approved ${entry} source (${sources.join(', ')}).`,
            ),
          );
      }
    }
  }
  return out;
}
