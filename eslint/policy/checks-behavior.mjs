/**
 * Cross-file guarantees about behavior conventions: audit wiring from
 * command to port, an explicit authorization category for every externally
 * reachable entry point, and translation ownership.
 */
import {
  isAuthorizationRoot,
  returnsOf,
  rootCall,
} from '../plugins/architecture/rules/use-cases/authorization-flow.mjs';

import { kebabToCamel, stripFileExtension } from './paths.mjs';
import { AUTHORIZATION } from './policy.mjs';
import { exportedNames, leadingComment, topLevelClasses, violation, visit } from './project.mjs';

function ctorDependencyName(classNode) {
  const ctor = classNode.body.body.find(
    (m) => m.type === 'MethodDefinition' && m.kind === 'constructor',
  );
  const param = ctor?.value.params[0];
  const type =
    param?.type === 'TSParameterProperty'
      ? param.parameter.typeAnnotation?.typeAnnotation
      : undefined;
  return type?.type === 'TSTypeReference' && type.typeName.type === 'Identifier'
    ? type.typeName.name
    : null;
}

/** All members of an interface, following `extends` through files. Returns Map(name -> type name | null). */
function interfaceMembers(project, file, interfaceName, seen = new Set()) {
  const key = `${file.path}::${interfaceName}`;
  const members = new Map();
  if (seen.has(key)) return members;
  seen.add(key);
  let declaration = null;
  for (const statement of file.ast.body) {
    const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (d?.type === 'TSInterfaceDeclaration' && d.id.name === interfaceName) declaration = d;
  }
  if (!declaration) return members;
  for (const member of declaration.body.body) {
    if (member.type !== 'TSPropertySignature' || member.key.type !== 'Identifier') continue;
    const type = member.typeAnnotation?.typeAnnotation;
    members.set(
      member.key.name,
      type?.type === 'TSTypeReference' && type.typeName.type === 'Identifier'
        ? type.typeName.name
        : null,
    );
  }
  for (const heritage of declaration.extends ?? []) {
    if (heritage.expression.type !== 'Identifier') continue;
    const parentName = heritage.expression.name;
    const imported = file.imports.find((i) => i.names?.includes(parentName));
    const parentFile = imported ? project.resolveFile(file.path, imported.specifier) : file;
    for (const [k, v] of interfaceMembers(project, parentFile ?? file, parentName, seen))
      members.set(k, v);
  }
  return members;
}

/** Literal `type` values of a discriminated union alias (`type XEvent = { type: 'a' } | { type: 'b' }`). */
function eventTypes(file, aliasName) {
  const types = new Set();
  for (const statement of file.ast.body) {
    const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (d?.type !== 'TSTypeAliasDeclaration' || d.id.name !== aliasName) continue;
    const members =
      d.typeAnnotation.type === 'TSUnionType' ? d.typeAnnotation.types : [d.typeAnnotation];
    for (const m of members) {
      for (const prop of m.members ?? []) {
        const literal = prop.typeAnnotation?.typeAnnotation;
        if (prop.key?.name === 'type' && literal?.type === 'TSLiteralType')
          types.add(literal.literal.value);
      }
    }
  }
  return types;
}

/**
 * Mandatory audit dependency, resolved end to end: command constructor →
 * its *Dependencies interface (following `extends`) → an `audit` member typed
 * as the module's audit port. Event emission is checked separately: every
 * `audit.record({ type })` uses a declared event type, and a command that
 * never records must say why (`@audit-exempt <reason>`).
 */
export function checkCommandAuditDependency(project) {
  const out = [];
  for (const name of project.modules) {
    const files = project.moduleFiles(name);
    const portFiles = files.filter((f) => /^domain\/ports\/.*-audit-log\.port\.ts$/.test(f.local));
    const ports = new Map(); // AuditLog interface name -> Set(event types)
    for (const f of portFiles) {
      const names = exportedNames(f);
      for (const n of names.filter((x) => /AuditLog$/.test(x)))
        ports.set(n, eventTypes(f, n.replace(/AuditLog$/, 'Event')));
    }
    for (const f of files.filter((x) => x.local.startsWith('application/commands/'))) {
      for (const cls of topLevelClasses(f)) {
        const depsName = ctorDependencyName(cls.node);
        if (depsName === null) {
          out.push(
            violation(
              'command-audit',
              f.path,
              `\`${cls.name}\` has no constructor dependencies, so it cannot receive an audit log.`,
            ),
          );
          continue;
        }
        const imported = f.imports.find((i) => i.names?.includes(depsName));
        const depsFile = imported ? project.resolveFile(f.path, imported.specifier) : null;
        if (!depsFile) {
          out.push(
            violation(
              'command-audit',
              f.path,
              `Cannot resolve \`${depsName}\` for \`${cls.name}\`; dependencies come from application/<module>-dependencies.ts.`,
            ),
          );
          continue;
        }
        const members = interfaceMembers(project, depsFile, depsName);
        const auditType = members.get('audit');
        if (auditType === undefined || auditType === null || !ports.has(auditType)) {
          out.push(
            violation(
              'command-audit',
              f.path,
              `\`${
                cls.name
              }\` is built from \`${depsName}\`, which has no \`audit\` member typed as one of this module's audit ports (${
                [...ports.keys()].join(', ') || 'none declared'
              }).`,
            ),
          );
          continue;
        }
        const allowed = ports.get(auditType) ?? new Set();
        let records = 0;
        visit(cls.node, {
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== 'MemberExpression' || callee.property.name !== 'record') return;
            const target = callee.object;
            const isAudit =
              (target.type === 'Identifier' && target.name === 'audit') ||
              (target.type === 'MemberExpression' && target.property.name === 'audit');
            if (!isAudit) return;
            records += 1;
            const literal = node.arguments[0]?.properties?.find(
              (p) => p.key?.name === 'type',
            )?.value;
            if (literal?.type === 'Literal' && allowed.size > 0 && !allowed.has(literal.value)) {
              out.push(
                violation(
                  'command-audit',
                  f.path,
                  `\`${cls.name}\` records event type '${
                    literal.value
                  }', which is not part of ${auditType.replace(/AuditLog$/, 'Event')}.`,
                ),
              );
            }
          },
        });
        const exempt = /@audit-exempt\s+\S/.test(leadingComment(f, cls.statement));
        if (records === 0 && !exempt) {
          out.push(
            violation(
              'command-audit',
              f.path,
              `\`${cls.name}\` receives the audit log but never records an event. Emit one for its outcome or document \`@audit-exempt <reason>\`.`,
            ),
          );
        }
        if (records > 0 && exempt) {
          out.push(
            violation(
              'command-audit',
              f.path,
              `\`${cls.name}\` is marked @audit-exempt but records events. Remove the exemption.`,
            ),
          );
        }
      }
    }
  }
  return out;
}

const ROUTE_TAG = /@authorization\s+(public|protected|none)\s+(\S.*)/;
const USE_CASE_TAG = /@authorization\s+(public|system)\s+(\S.*)/;
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/** The authorization category of one use case class. */
function classifyUseCase(file, cls) {
  const depsName = ctorDependencyName(cls.node);
  const tag = USE_CASE_TAG.exec(leadingComment(file, cls.statement));
  const execute = cls.node.body.body.find(
    (m) => m.type === 'MethodDefinition' && m.key.name === 'execute',
  );
  const returns = execute ? returnsOf(execute.value.body) : [];
  const authorizedFirst =
    returns.length > 0 &&
    returns.every((r) => r.argument && isAuthorizationRoot(rootCall(r.argument)));
  const category = tag ? tag[1] : 'protected';
  return {
    depsName,
    tag: tag ? { category: tag[1], reason: tag[2].trim() } : null,
    authorizedFirst,
    category,
  };
}

/**
 * Every use case and every externally reachable entry point has an
 * explicit authorization category.
 *
 *  - protected (the default): `execute` starts with authorization.
 *  - public: no actor needed (world-readable data, or an authentication flow
 *    gated by something else such as a rate limiter). Tagged
 *    `@authorization public <reason>` in the class comment.
 *  - system: a trusted in-process caller (another module's adapter). Tagged
 *    `@authorization system <reason>` and NEVER reachable from a Server Action
 *    or route handler.
 *
 * The category is a recorded decision, not inferred from a name. Whether
 * access control actually behaves is exercised by integration tests.
 */
export function describeEntryPoints(project) {
  const entries = [];
  const useCases = new Map(); // `${module}::${ClassName}` -> classification

  for (const name of project.modules) {
    for (const f of project
      .moduleFiles(name)
      .filter((x) => /^application\/(?:commands|queries)\//.test(x.local))) {
      for (const cls of topLevelClasses(f)) {
        const info = classifyUseCase(f, cls);
        useCases.set(`${name}::${cls.name}`, {
          ...info,
          file: f,
          name: cls.name,
        });
        entries.push({
          kind: 'use-case',
          module: name,
          name: cls.name,
          file: f.path,
          category: info.category,
          reason: info.tag?.reason ?? null,
          ok: info.category === 'protected' ? info.authorizedFirst : true,
          info,
        });
      }
    }
  }

  for (const name of project.modules) {
    const files = project.moduleFiles(name);
    const composition = files.find((x) => x.local === 'composition.ts');
    const objects = new Map(); // `${objectName}.${key}` -> class name
    if (composition) {
      const collect = (id, init) => {
        const object = init?.type === 'TSAsExpression' ? init.expression : init;
        if (object?.type !== 'ObjectExpression') return;
        for (const p of object.properties)
          if (p.value?.type === 'NewExpression' && p.value.callee.type === 'Identifier')
            objects.set(`${id}.${p.key.name}`, p.value.callee.name);
      };
      visit(composition.ast, {
        VariableDeclarator(v) {
          if (v.id.type === 'Identifier') collect(v.id.name, v.init);
        },
        // lazy form: `export const getAuthCommands = once(() => { …; return { signIn: new SignIn(...) }; })`
        CallExpression(call, owner) {
          if (
            call.callee.type !== 'Identifier' ||
            call.callee.name !== 'once' ||
            owner?.type !== 'VariableDeclarator' ||
            owner.id.type !== 'Identifier'
          )
            return;
          const fn = call.arguments[0];
          if (!fn || !/Function/.test(fn.type)) return;
          if (fn.body.type === 'ObjectExpression') collect(`${owner.id.name}()`, fn.body);
          else
            visit(fn.body, {
              ReturnStatement: (r) => collect(`${owner.id.name}()`, r.argument),
            });
        },
        FunctionDeclaration(fn) {
          if (!fn.id) return;
          visit(fn.body, {
            ReturnStatement: (r) => collect(`${fn.id.name}()`, r.argument),
          });
          visit(fn.body, {
            VariableDeclarator: (v) =>
              v.id.type === 'Identifier' && collect(`${fn.id.name}()`, v.init),
          });
        },
      });
    }
    for (const f of files.filter((x) => /^presentation\/actions\//.test(x.local))) {
      for (const statement of f.ast.body) {
        const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
        if (d?.type !== 'FunctionDeclaration') continue;
        const called = new Set();
        visit(d, {
          CallExpression(node) {
            const c = node.callee;
            if (
              c.type !== 'MemberExpression' ||
              c.property.name !== 'execute' ||
              c.object.type !== 'MemberExpression'
            )
              return;
            const holder = c.object.object;
            const rootName =
              holder.type === 'Identifier'
                ? holder.name
                : holder.type === 'CallExpression' && holder.callee.type === 'Identifier'
                  ? `${holder.callee.name}()`
                  : null;
            if (rootName) called.add(`${rootName}.${c.object.property.name}`);
          },
        });
        const resolved = [...called].map((k) => objects.get(k)).filter(Boolean);
        const classified = resolved.map((cn) => useCases.get(`${name}::${cn}`)).filter(Boolean);
        const reachesSystem = classified.some((c) => c.category === 'system');
        entries.push({
          kind: 'action',
          module: name,
          name: d.id.name,
          file: f.path,
          category:
            classified.length === 0
              ? 'unclassified'
              : classified.every((c) => c.category === 'public')
                ? 'public'
                : 'protected',
          ok: classified.length > 0 && classified.length === called.size && !reachesSystem,
          useCases: resolved,
          reachesSystem,
        });
      }
    }
  }

  for (const file of project.files.values()) {
    if (!/^src\/app\/.*\/?route\.ts$/.test(file.path)) continue;
    for (const statement of file.ast.body) {
      const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
      const method =
        d?.type === 'FunctionDeclaration'
          ? d.id.name
          : d?.type === 'VariableDeclaration'
            ? d.declarations[0]?.id?.name
            : null;
      if (!method || !HTTP_METHODS.has(method)) continue;
      const tag = ROUTE_TAG.exec(leadingComment(file, statement));
      let usesUseCase = false;
      visit(d, {
        CallExpression: (n) => {
          if (n.callee.type === 'MemberExpression' && n.callee.property.name === 'execute')
            usesUseCase = true;
        },
      });
      const category = tag?.[1] ?? 'undeclared';
      entries.push({
        kind: 'route-handler',
        module: null,
        name: `${method} ${file.path}`,
        file: file.path,
        category,
        reason: tag ? (tag[2]?.trim() ?? null) : null,
        ok: tag !== null && (category !== 'protected' || usesUseCase),
      });
    }
  }
  return entries;
}

export function checkAuthorizationCategories(project) {
  const out = [];
  for (const e of describeEntryPoints(project)) {
    if (e.ok) continue;
    if (e.kind === 'use-case') {
      out.push(
        violation(
          'authorization',
          e.file,
          `\`${e.name}\` is protected (it has no \`@authorization\` tag) but \`execute\` does not start with authorization (${AUTHORIZATION.actorCall} / loadAuthorized*). Authorize first, or tag the class \`@authorization public <reason>\` / \`@authorization system <reason>\` if it deliberately has no actor.`,
        ),
      );
    } else if (e.kind === 'action') {
      out.push(
        e.reachesSystem
          ? violation(
              'authorization',
              e.file,
              `Server Action \`${e.name}\` calls a \`system\` use case. System use cases have no authorization and must only be called by other modules' adapters.`,
            )
          : violation(
              'authorization',
              e.file,
              `Server Action \`${e.name}\` does not resolve to a use case in the module's composition root, so its authorization category is unknown.`,
            ),
      );
    } else {
      out.push(
        violation(
          'authorization',
          e.file,
          `Route handler ${e.name} needs a JSDoc \`@authorization <protected|public|none> <reason>\` and, when protected, must call a use case.`,
        ),
      );
    }
  }
  return out;
}

/** Pure check over message data, so it runs on the real module and on fixtures alike. */
export function verifyMessageMap({ module, codes, keyByCode, genericKey, catalogs }) {
  const out = [];
  const resolve = (catalog, key) =>
    key
      .split('.')
      .reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog);
  for (const code of codes) {
    if (!Object.hasOwn(keyByCode, code))
      out.push(
        violation('messages', module, `Code '${code}' has no entry in MESSAGE_KEY_BY_CODE.`),
      );
  }
  for (const code of Object.keys(keyByCode)) {
    if (!codes.includes(code))
      out.push(
        violation(
          'messages',
          module,
          `MESSAGE_KEY_BY_CODE maps '${code}', which is not an error or validation code of this module.`,
        ),
      );
  }
  const keys = new Set([...Object.values(keyByCode), genericKey]);
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const key of keys) {
      if (typeof resolve(catalog, key) !== 'string')
        out.push(
          violation(
            'messages',
            module,
            `Translation key '${key}' is missing in the '${locale}' catalog.`,
          ),
        );
    }
  }
  return out;
}

export function flattenKeys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flattenKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** Module translations stay in the module, are registered with the global locales, and stay complete. */
export function checkTranslationOwnership(project) {
  const out = [];
  const locales = [...project.files.keys()]
    .filter((p) => /^src\/i18n\/locales\/[^/]+\.ts$/.test(p))
    .map((p) => stripFileExtension(p.split('/').pop()));

  for (const name of project.modules) {
    const dir = `src/modules/${name}/presentation/i18n/`;
    const jsonPaths = [...project.json.keys()].filter(
      (p) => p.startsWith(dir) && p.endsWith('.json'),
    );
    if (jsonPaths.length === 0) continue;
    const moduleLocales = jsonPaths.map((p) => stripFileExtension(p.slice(dir.length)));
    const parsed = {};
    for (const [i, p] of jsonPaths.entries()) {
      try {
        parsed[moduleLocales[i]] = JSON.parse(project.json.get(p));
      } catch (error) {
        out.push(
          violation(
            'translations',
            p,
            `Not valid JSON (${error.message}). Bundlers parse catalogs strictly: no trailing commas or comments.`,
          ),
        );
      }
    }
    if (Object.keys(parsed).length !== jsonPaths.length) continue;

    for (const locale of locales) {
      if (!moduleLocales.includes(locale))
        out.push(
          violation(
            'translations',
            dir,
            `Module '${name}' has no '${locale}' translations (the app supports: ${locales.join(
              ', ',
            )}).`,
          ),
        );
    }
    for (const locale of moduleLocales) {
      if (!locales.includes(locale))
        out.push(
          violation(
            'translations',
            `${dir}${locale}.json`,
            `'${locale}' is not a supported locale (${locales.join(', ')}).`,
          ),
        );
    }
    for (const locale of moduleLocales) {
      const top = Object.keys(parsed[locale]);
      const namespace = kebabToCamel(name);
      if (top.length !== 1 || top[0] !== namespace)
        out.push(
          violation(
            'translations',
            `${dir}${locale}.json`,
            `The catalog must have exactly one top-level namespace named after the module ('${namespace}'); found: ${
              top.join(', ') || 'none'
            }.`,
          ),
        );
    }
    // A key must exist in every locale: report it against each locale that lacks it.
    const keysByLocale = Object.fromEntries(
      moduleLocales.map((l) => [l, new Set(flattenKeys(parsed[l]))]),
    );
    const union = new Set(moduleLocales.flatMap((l) => [...keysByLocale[l]]));
    for (const locale of [...moduleLocales].sort()) {
      for (const key of [...union].sort()) {
        if (keysByLocale[locale].has(key)) continue;
        const present = moduleLocales
          .filter((l) => keysByLocale[l].has(key))
          .sort()
          .join(', ');
        out.push(
          violation(
            'translations',
            `${dir}${locale}.json`,
            `Missing key '${key}' in '${locale}' (present in: ${present}).`,
          ),
        );
      }
    }

    // Each locale's catalog must be exported by the public API and registered in src/i18n/locales/<locale>.ts.
    // The export name is the module's choice (`enLessonPlan`); what matters is that the same name flows from
    // the module's index.ts into the registry.
    const index = project.files.get(`src/modules/${name}/index.ts`);
    for (const locale of locales) {
      const registry = project.files.get(`src/i18n/locales/${locale}.ts`);
      if (!registry) continue;
      const registered = registry.imports
        .filter((i) => i.specifier === `@modules/${name}`)
        .flatMap((i) => i.names ?? [])
        .filter((n) => new RegExp(`^${locale}[A-Z]`).test(n));
      if (registered.length === 0) {
        out.push(
          violation(
            'translations',
            registry.path,
            `Module '${name}' translations are not registered: import its '${locale}…' catalog from '@modules/${name}' in this file.`,
          ),
        );
        continue;
      }
      if (index && !registered.every((n) => exportedNames(index).includes(n))) {
        out.push(
          violation(
            'translations',
            index.path,
            `The module public API must export ${registered
              .map((n) => `\`${n}\``)
              .join(', ')} (registered in src/i18n/locales/${locale}.ts).`,
          ),
        );
      }
    }
  }

  // Global catalogs hold shared text only.
  for (const path of project.json.keys()) {
    const m = /^src\/i18n\/messages\/([^/]+)\/(.+)\.json$/.exec(path);
    if (!m) continue;
    if (project.modules.includes(m[2]))
      out.push(
        violation(
          'translations',
          path,
          `'${m[2]}' is a module: its translations belong in src/modules/${m[2]}/presentation/i18n, not in the global catalog.`,
        ),
      );
    let parsedGlobal = {};
    try {
      parsedGlobal = JSON.parse(project.json.get(path));
    } catch (error) {
      out.push(
        violation(
          'translations',
          path,
          `Not valid JSON (${error.message}). Bundlers parse catalogs strictly: no trailing commas or comments.`,
        ),
      );
    }
    for (const top of Object.keys(parsedGlobal)) {
      if (project.modules.includes(top))
        out.push(
          violation(
            'translations',
            path,
            `Top-level key '${top}' is a module namespace; keep module text inside the module.`,
          ),
        );
    }
  }
  return out;
}
