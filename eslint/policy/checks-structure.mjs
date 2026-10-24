/**
 * Whole-tree structure checks: things a single file cannot prove.
 * Capabilities are inferred from what a module actually contains, so a
 * module is never asked to create files for a capability it does not have.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MANIFEST_FILE, MANIFEST_KEYS, MIN_REASON_LENGTH } from './manifest.mjs';
import { kebabToPascal } from './paths.mjs';
import { ROLES, policyFor } from './policy.mjs';
import { exportedNames, topLevelClasses, violation } from './project.mjs';

const hasFile = (files, local) => files.some((f) => f.local === local);
const under = (files, prefix) => files.filter((f) => f.local.startsWith(prefix));

/** Modules, roles and capability pairs (repository <-> mapper, audit port <-> adapter, messages). */
export function checkModuleStructure(project) {
  const out = [];
  for (const name of project.modules) {
    const files = project.moduleFiles(name);
    const policy = policyFor(name, project.root);
    const at = `src/modules/${name}`;

    if (!hasFile(files, 'index.ts'))
      out.push(
        violation(
          'module-structure',
          `${at}/index.ts`,
          `Module '${name}' has no public API (index.ts).`,
        ),
      );

    const useCases = [
      ...under(files, 'application/commands/'),
      ...under(files, 'application/queries/'),
    ];
    if (
      policy.role.requireComposition &&
      useCases.length > 0 &&
      !hasFile(files, policy.compositionFile)
    ) {
      out.push(
        violation(
          'module-structure',
          `${at}/${policy.compositionFile}`,
          `Module '${name}' has use cases but no composition root (${policy.compositionFile}).`,
        ),
      );
    }

    // persistence capability
    for (const port of under(files, 'domain/ports/').filter((f) =>
      /\.repository\.ts$/.test(f.local),
    )) {
      const base = port.local.replace(/^domain\/ports\//, '').replace(/\.repository\.ts$/, '');
      if (!hasFile(files, `infrastructure/prisma/prisma-${base}.repository.ts`)) {
        out.push(
          violation(
            'repository-pairs',
            port.path,
            `Repository port '${base}.repository.ts' has no adapter 'infrastructure/prisma/prisma-${base}.repository.ts'.`,
          ),
        );
      }
      if (
        policy.role.repositoriesRequireRecordMapper &&
        !hasFile(files, `infrastructure/prisma/${base}-record-mapper.ts`)
      ) {
        out.push(
          violation(
            'repository-pairs',
            port.path,
            `Repository '${base}' has no record mapper 'infrastructure/prisma/${base}-record-mapper.ts' (selections and record conversions live there).`,
          ),
        );
      }
    }
    for (const adapter of under(files, 'infrastructure/prisma/').filter((f) =>
      /prisma-.+\.repository\.ts$/.test(f.local),
    )) {
      const base = adapter.local
        .replace(/^infrastructure\/prisma\/prisma-/, '')
        .replace(/\.repository\.ts$/, '');
      if (!hasFile(files, `domain/ports/${base}.repository.ts`)) {
        out.push(
          violation(
            'repository-pairs',
            adapter.path,
            `Adapter '${adapter.local}' implements no domain port 'domain/ports/${base}.repository.ts'.`,
          ),
        );
      }
    }

    // audit capability
    const auditPorts = under(files, 'domain/ports/').filter((f) =>
      /-audit-log\.port\.ts$/.test(f.local),
    );
    for (const port of auditPorts) {
      const base = port.local.replace(/^domain\/ports\//, '').replace(/-audit-log\.port\.ts$/, '');
      const adapter = [`infrastructure/audit/logger-${base}-audit-log.ts`].find((p) =>
        hasFile(files, p),
      );
      if (!adapter)
        out.push(
          violation(
            'audit-coverage',
            port.path,
            `Audit port '${port.local}' has no adapter 'infrastructure/audit/logger-${base}-audit-log.ts'.`,
          ),
        );
      const exported = exportedNames(port);
      const pascal = kebabToPascal(base);
      if (!exported.includes(`${pascal}AuditLog`) || !exported.includes(`${pascal}Event`)) {
        out.push(
          violation(
            'audit-coverage',
            port.path,
            `Audit port must export \`${pascal}AuditLog\` and the event union \`${pascal}Event\`.`,
          ),
        );
      }
    }
    for (const adapter of [...under(files, 'infrastructure/audit/')]) {
      const base = adapter.local
        .split('/')
        .pop()
        .replace(/^logger-/, '')
        .replace(/-audit-log\.ts$/, '');
      if (!hasFile(files, `domain/ports/${base}-audit-log.port.ts`)) {
        out.push(
          violation(
            'audit-coverage',
            adapter.path,
            `Audit adapter '${adapter.local}' implements no domain audit port '${base}-audit-log.port.ts'.`,
          ),
        );
      }
    }
    if (
      policy.role.commandsRequireAudit &&
      under(files, 'application/commands/').length > 0 &&
      auditPorts.length === 0
    ) {
      out.push(
        violation(
          'audit-coverage',
          at,
          `Module '${name}' has commands but no audit port (domain/ports/<name>-audit-log.port.ts).`,
        ),
      );
    }

    // messages capability: translations travel with their message map and catalog
    const jsonLocales = [...project.json.keys()].filter((p) =>
      p.startsWith(`${at}/presentation/i18n/`),
    );
    const hasKeys = hasFile(files, 'presentation/messages/message-keys.ts');
    if (jsonLocales.length > 0 && !hasKeys) {
      out.push(
        violation(
          'messages',
          `${at}/presentation/messages`,
          `Module '${name}' ships translations but has no presentation/messages/message-keys.ts mapping its codes to keys.`,
        ),
      );
    }
    if (hasKeys && jsonLocales.length === 0) {
      out.push(
        violation(
          'messages',
          `${at}/presentation/messages/message-keys.ts`,
          `Module '${name}' maps codes to translation keys but ships no presentation/i18n/<locale>.json.`,
        ),
      );
    }

    // No placeholder files: every file must contain code, not only comments.
    for (const f of files) {
      if (f.ast.body.length === 0)
        out.push(
          violation(
            'no-placeholders',
            f.path,
            'Empty file. Do not add placeholder files to satisfy a structure; create files only for capabilities the module has.',
          ),
        );
    }

    // Error-code conventions: stable identifiers, not prose.
    for (const f of under(files, 'domain/errors/')) {
      for (const statement of f.ast.body) {
        const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
        if (d?.type !== 'VariableDeclaration') continue;
        for (const v of d.declarations) {
          if (v.id.type !== 'Identifier' || !/_CODES$/.test(v.id.name)) continue;
          if (!/^[A-Z0-9]+(?:_[A-Z0-9]+)*_(?:ERROR|VALIDATION)_CODES$/.test(v.id.name)) {
            out.push(
              violation(
                'error-codes',
                f.path,
                `'${v.id.name}' must be named <MODULE>_ERROR_CODES or <MODULE>_VALIDATION_CODES.`,
              ),
            );
          }
          const object = v.init?.type === 'TSAsExpression' ? v.init.expression : v.init;
          for (const p of object?.properties ?? []) {
            const value = p.value;
            if (!(
              value?.type === 'Literal' &&
              typeof value.value === 'string' &&
              /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/.test(value.value)
            )) {
              out.push(
                violation(
                  'error-codes',
                  f.path,
                  `Code '${p.key.name ?? p.key.value}' in ${
                    v.id.name
                  } must be a stable dotted identifier such as 'module.some_code', not text shown to users.`,
                ),
              );
            }
          }
        }
      }
    }
  }
  return out;
}

/** Exported `const x: Port = …` values: an adapter built by a factory (e.g. `createAuditLog`) instead of a class. */
function portTypedConstants(file) {
  const constants = [];
  for (const statement of file.ast.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    )
      continue;
    for (const declarator of statement.declaration.declarations) {
      const annotation = declarator.id.typeAnnotation?.typeAnnotation;
      if (
        declarator.id.type === 'Identifier' &&
        annotation?.type === 'TSTypeReference' &&
        annotation.typeName.type === 'Identifier'
      ) {
        constants.push({ name: declarator.id.name, type: annotation.typeName.name });
      }
    }
  }
  return constants;
}

/**
 * Adapters of a module: a class declared in infrastructure that implements an interface exported by a domain port,
 * or an exported constant typed as one (`kind: 'value'`).
 */
export function portImplementations(project, name) {
  const found = [];
  for (const f of project.moduleFiles(name).filter((x) => x.local.startsWith('infrastructure/'))) {
    const isPortName = (n) =>
      f.imports.some(
        (imp) =>
          imp.names?.includes(n) && /domain\/ports\//.test(imp.specifier.replace(/\\/g, '/')),
      );
    for (const constant of portTypedConstants(f)) {
      if (isPortName(constant.type))
        found.push({ file: f, name: constant.name, implemented: [constant.type], kind: 'value' });
    }
    for (const cls of topLevelClasses(f)) {
      const implemented = (cls.node.implements ?? [])
        .filter((i) => i.expression.type === 'Identifier')
        .map((i) => i.expression.name);
      if (implemented.length === 0) continue;
      const fromPorts = f.imports.some(
        (imp) =>
          imp.names?.some((n) => implemented.includes(n)) &&
          /domain\/ports\//.test(imp.specifier.replace(/\\/g, '/')),
      );
      if (fromPorts) found.push({ file: f, name: cls.name, implemented, kind: 'class' });
    }
  }
  return found;
}

/**
 * Validates module manifests (src/modules/<name>/module.json) against policy and the actual files.
 */
export function checkModuleManifests(project) {
  const out = [];
  const modulesDir = join(project.root, 'src', 'modules');
  const allModules = existsSync(modulesDir)
    ? [
        ...new Set([
          ...readdirSync(modulesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name),
          ...project.modules,
        ]),
      ].sort()
    : project.modules;

  for (const name of allModules) {
    const relPath = `src/modules/${name}/${MANIFEST_FILE}`;
    const absPath = join(project.root, relPath);
    if (!existsSync(absPath)) continue;

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(absPath, 'utf8'));
    } catch {
      out.push(violation('module-manifest', relPath, 'Manifest is not valid JSON.'));
      continue;
    }

    if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
      out.push(violation('module-manifest', relPath, 'Manifest must be an object.'));
      continue;
    }

    for (const key of Object.keys(manifest)) {
      if (!MANIFEST_KEYS.includes(key)) {
        out.push(
          violation(
            'module-manifest',
            relPath,
            `Unknown manifest key '${key}'. Allowed: ${MANIFEST_KEYS.join(', ')}.`,
          ),
        );
      }
    }

    if (typeof manifest.reason !== 'string' || manifest.reason.trim().length < MIN_REASON_LENGTH) {
      out.push(
        violation(
          'module-manifest',
          relPath,
          `Manifest must declare a 'reason' of at least ${MIN_REASON_LENGTH} characters explaining why '${name}' differs from a standard module.`,
        ),
      );
    }

    if (manifest.role !== undefined && !(manifest.role in ROLES)) {
      out.push(
        violation(
          'module-manifest',
          relPath,
          `Unknown module role '${manifest.role}'. Allowed roles: ${Object.keys(ROLES).join(', ')}.`,
        ),
      );
    }

    if (manifest.runtimeExports !== undefined) {
      if (!Array.isArray(manifest.runtimeExports)) {
        out.push(violation('module-manifest', relPath, `'runtimeExports' must be an array.`));
      } else {
        const indexFile = project.files.get(`src/modules/${name}/index.ts`);
        const names = indexFile ? new Set(exportedNames(indexFile)) : new Set();
        for (const exp of manifest.runtimeExports) {
          if (!names.has(exp)) {
            out.push(
              violation(
                'module-manifest',
                relPath,
                `Runtime export '${exp}' declared in manifest is not exported by '${name}/index.ts'.`,
              ),
            );
          }
        }
      }
    }

    if (manifest.extraRootFiles !== undefined) {
      if (
        typeof manifest.extraRootFiles !== 'object' ||
        manifest.extraRootFiles === null ||
        Array.isArray(manifest.extraRootFiles)
      ) {
        out.push(violation('module-manifest', relPath, `'extraRootFiles' must be an object.`));
      } else {
        for (const [layer, files] of Object.entries(manifest.extraRootFiles)) {
          if (Array.isArray(files)) {
            for (const file of files) {
              const expectedPath = `src/modules/${name}/${layer}/${file}`;
              if (!project.files.has(expectedPath)) {
                out.push(
                  violation(
                    'module-manifest',
                    relPath,
                    `Extra root file '${file}' in layer '${layer}' declared in manifest does not exist at '${expectedPath}'.`,
                  ),
                );
              }
            }
          }
        }
      }
    }
  }
  return out;
}
