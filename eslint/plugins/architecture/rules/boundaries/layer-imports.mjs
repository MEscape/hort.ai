import { isPublicApiOf, sharedLibName, stripFileExtension } from '../../../../policy/paths.mjs';
import {
  FORBIDDEN_PACKAGES,
  I18N_INFRASTRUCTURE_ALLOW,
  I18N_VOCABULARY_ALLOW,
  SERVER_ONLY_SPECIFIERS,
  SHARED_LIB_ALLOW,
  SHARED_PORT_LIBS,
  TRUSTED_BRAND_CONSTRUCTOR,
  policyFor,
} from '../../../../policy/policy.mjs';
import {
  classifyContext,
  defineRule,
  hasDirective,
  moduleSpecifierVisitors,
  report,
  resolveFrom,
} from '../../util.mjs';

const LAYER_LABEL = {
  domain: 'Domain',
  application: 'Application',
  infrastructure: 'Infrastructure',
  presentation: 'Presentation',
  root: 'Module root',
};

/**
 * Returns a message when `file` (in `repoPath`) must not import `target`, else null.
 * Pure function: also used by the architecture tests. `root` is the repository root, where module manifests live.
 */
export function checkLayerImport({
  repoPath,
  file,
  target,
  specifier,
  isTypeOnly,
  names,
  root = process.cwd(),
}) {
  if (target.kind === 'package') return checkPackage(file, target);
  if (file.area === 'module')
    return checkModuleFile({ repoPath, file, target, specifier, isTypeOnly, names, root });
  if (
    file.area === 'lib' ||
    file.area === 'components' ||
    file.area === 'hooks' ||
    file.area === 'store' ||
    file.area === 'types'
  ) {
    if (target.area === 'module') {
      return `Shared code (${file.area}/) must not depend on business modules. Move the shared piece into src/lib or pass it in from the module.`;
    }
    if (target.area === 'app')
      return `${file.area}/ must not import from src/app (framework entry points).`;
  }
  return null;
}

function checkPackage(file, target) {
  if (
    /^@prisma($|\/)/.test(target.specifier) &&
    !(file.area === 'lib' && file.path.startsWith('src/lib/db/'))
  ) {
    return `Prisma is an implementation detail of '@lib/db'. Use \`db\` and \`createPersistenceFailures\` from '@lib/db' inside an infrastructure/prisma repository.`;
  }
  if (file.area !== 'module') return null;
  const forbidden = FORBIDDEN_PACKAGES[file.layer];
  if (forbidden?.some((pattern) => pattern.test(target.specifier))) {
    return `${LAYER_LABEL[file.layer]} must not depend on '${target.specifier}' (framework/IO). Keep this layer free of React, Next.js, Prisma and i18n.`;
  }
  return null;
}

function checkModuleFile({ file, target, isTypeOnly, names, root }) {
  const layer = file.layer;
  const label = LAYER_LABEL[layer] ?? layer;
  const policy = policyFor(file.module, root);

  if (target.area === 'app')
    return `${label} must not import from src/app (framework entry points).`;

  if (target.area === 'module') {
    if (target.module !== file.module)
      return checkCrossModule({ file, layer, label, target, isTypeOnly, names, root });
    return checkSameModule({ file, layer, label, target, policy });
  }

  if (target.area === 'lib') {
    const allow = SHARED_LIB_ALLOW[layer] ?? null;
    if (allow === null) return null;
    const lib = sharedLibName(target);
    if (lib !== null && SHARED_PORT_LIBS.includes(lib)) {
      return isTypeOnly
        ? null
        : `${label} may only \`import type\` from '@lib/${lib}': it defines a port. The implementation is wired by composition.ts and handed in.`;
    }
    if (lib !== null && !allow.includes(lib)) {
      return `${label} must not import '@lib/${lib}'. Allowed shared libraries here: ${allow.map((n) => `@lib/${n}`).join(', ')}.`;
    }
    return null;
  }

  if (target.area === 'components' && layer !== 'presentation' && layer !== 'root') {
    return `${label} must not import shared UI ('@components/*'). UI belongs to the presentation layer.`;
  }
  if (target.area === 'i18n' && (layer === 'infrastructure' || layer === 'root')) {
    const allowed = layer === 'infrastructure' ? I18N_INFRASTRUCTURE_ALLOW : I18N_VOCABULARY_ALLOW;
    if (names !== null && names.length > 0 && names.every((n) => allowed.includes(n))) return null;
    return `${label} must not import '@i18n' (only ${allowed.join(', ')} may be read here). Translation is a presentation concern.`;
  }
  if (
    (target.area === 'hooks' || target.area === 'store') &&
    layer !== 'presentation' &&
    layer !== 'root'
  ) {
    return `${label} must not import '${target.area}/'. Client state belongs to presentation.`;
  }
  return null;
}

function checkCrossModule({ file, layer, label, target, isTypeOnly, names, root }) {
  if (!isPublicApiOf(target)) return null; // deep imports are reported by `no-cross-module-deep-imports`
  if (layer === 'domain' || layer === 'application') {
    const approved = policyFor(target.module, root).runtimeExports;
    if (
      !isTypeOnly &&
      names !== null &&
      names.length > 0 &&
      names.every((n) => approved.includes(n))
    )
      return null;
    if (!isTypeOnly) {
      return `${label} may only \`import type\` from another module's public API. Runtime calls into '${target.module}' belong in an infrastructure adapter that implements a ${file.module} domain port.`;
    }
    return null;
  }
  if (layer === 'presentation' && !isTypeOnly && target.file !== 'client') {
    return `Presentation may use another module only through its browser-safe API ('@modules/${target.module}/client': routes, vocabulary, actions) or \`import type\`. Server-side parts of '${target.module}' are wired in ${file.module}'s composition.ts and handed in.`;
  }
  if (layer === 'infrastructure' && file.dir === 'prisma' && !isTypeOnly) {
    const onlyBrandConstructors =
      names !== null &&
      names.length > 0 &&
      names.every((name) => TRUSTED_BRAND_CONSTRUCTOR.test(name));
    if (!onlyBrandConstructors) {
      return `Repositories and record mappers must not call another module ('${target.module}'). Integrate through an infrastructure adapter (e.g. infrastructure/provisioner) implementing a domain port. Only trusted brand constructors (to<Name>Id) may be imported here.`;
    }
  }
  return null;
}

function checkSameModule({ file, layer, label, target, policy }) {
  const to = target.layer;
  const isCompositionFile = to === 'root' && target.file === 'composition';

  if (isCompositionFile) {
    // Server Components and guards read through composition (docs/rules/nextjs.md); Client Components are rejected
    // by the 'use client' check below and by the client/server graph test, so they cannot slip through here.
    if (layer === 'presentation' && ['actions', 'guards', 'components'].includes(file.dir))
      return null;
    if (layer === 'root') {
      // client.ts is the browser-safe entry: composition reaches the server and is never one of its sources.
      return stripFileExtension(file.file) === 'client'
        ? checkPublicApiSource(
            file,
            target,
            policy.clientApiSources,
            'browser-safe API (client.ts)',
          )
        : null;
    }
    if (layer === 'infrastructure' && file.path.endsWith(`/${policy.compositionFile ?? '\0'}`))
      return null;
    return `${label} must not import the module's composition root. Only Server Actions, guards and Server Components (presentation/actions|guards|components) and the module's index.ts may reach composition.ts.`;
  }

  if (layer === 'root') {
    const self = stripFileExtension(file.file);
    if (self === 'composition') return null;
    if (self === 'index')
      return checkPublicApiSource(file, target, policy.publicApiSources, 'public API (index.ts)');
    if (self === 'client')
      return checkPublicApiSource(
        file,
        target,
        policy.clientApiSources,
        'browser-safe API (client.ts)',
      );
    return null;
  }

  if (to === 'root') {
    if (target.file === 'index' || target.file === 'client')
      return `${label} must not import the module's own public API (${target.file}.ts); import the file directly to avoid cycles.`;
    return null;
  }

  const allowed = {
    domain: ['domain'],
    application: ['domain', 'application'],
    infrastructure: ['domain', 'application', 'infrastructure'],
    presentation: ['presentation', 'application'],
  }[layer];
  if (allowed === undefined) return null;
  if (!allowed.includes(to)) {
    const hint = {
      domain: 'Domain depends on nothing outside the domain (and shared errors/result/utils).',
      application:
        'Application depends on the domain only; reach infrastructure through domain ports and the composition root.',
      infrastructure: 'Infrastructure implements domain ports; it must not depend on presentation.',
      presentation:
        to === 'domain'
          ? "Read domain constants/types through 'application/contracts/<module>-constraints.ts', the presentation-facing re-export."
          : 'Presentation talks to the application through the composition root and application contracts only.',
    }[layer];
    return `${label} must not import ${to}. ${hint}`;
  }
  if (layer === 'presentation' && to === 'application' && target.dir !== 'contracts') {
    return `Presentation may only import application/contracts (views and constraints). Call use cases through composition.ts from a Server Action.`;
  }
  return null;
}

function checkPublicApiSource(file, target, sources, what) {
  const inner = target.path.split('/').slice(3).join('/');
  const ok = sources.some((prefix) =>
    prefix.endsWith('/') ? inner.startsWith(prefix) : inner === prefix,
  );
  if (ok) return null;
  return `'${inner}' must not be part of the module's ${what}. Allowed sources: ${sources.join(', ')}. Infrastructure, repositories and record mappers are never public.`;
}

export const layerImports = defineRule({
  description:
    'Enforce layer dependency direction, shared-library allow-lists and the public-API contract across imports, re-exports and dynamic imports.',
  create(context) {
    const { repoPath, file } = classifyContext(context);
    if (file.area === 'other') return {};
    let isClient = false;
    return {
      Program(node) {
        isClient = hasDirective(node, 'use client');
      },
      ...moduleSpecifierVisitors(({ node, specifier, isTypeOnly, names }) => {
        const target = resolveFrom(repoPath, specifier);
        let message = checkLayerImport({
          repoPath,
          file,
          target,
          specifier,
          isTypeOnly,
          names,
          root: context.cwd,
        });
        if (
          message === null &&
          isClient &&
          !isTypeOnly &&
          target.kind === 'internal' &&
          target.path.startsWith('src/lib/config') &&
          names?.includes('serverEnv')
        ) {
          message =
            "Client Components must not import `serverEnv` (it holds secrets). Import `publicEnv` from '@lib/config'.";
        }
        if (message === null && isClient && !isTypeOnly) {
          const serverOnly =
            SERVER_ONLY_SPECIFIERS.some((pattern) => pattern.test(specifier)) ||
            (target.kind === 'internal' &&
              target.area === 'module' &&
              (target.file === 'composition' || target.layer === 'infrastructure'));
          if (serverOnly) {
            message = `Client Components must not import server-only code ('${specifier}'). Call a Server Action instead; composition roots and infrastructure never enter the client bundle.`;
          }
        }
        if (message !== null) report(context, node, message);
      }),
    };
  },
});
