import { relative, resolve } from 'node:path';

import ts from 'typescript';

/**
 * How an export is used, from the point of view of the code that ships:
 *  - `dead`: nothing references it, not even its own file.
 *  - `test-only`: only tests reference it (a helper waiting for its caller, or code that is only tested).
 *  - `unneeded-export`: only its own file references it, so `export` can go.
 */
export type ExportUse = 'dead' | 'test-only' | 'unneeded-export';

export interface ExportFinding {
  /** Repo-relative, `/`-separated. */
  readonly file: string;
  readonly line: number;
  readonly name: string;
  readonly kind: 'value' | 'type';
  readonly use: ExportUse;
}

export interface DeadCodeOptions {
  readonly root: string;
  /** Repo-relative prefix of the files whose exports are judged; every file of the program counts as a user. */
  readonly scope?: string;
  /** Repo-relative prefix of the test files: a reference from there is "test-only", not a use. */
  readonly testsDir?: string;
}

const DEFAULT_SCOPE = 'src/';
const DEFAULT_TESTS_DIR = '__tests__/';

/** Files that are never program code: scratch, dependencies, declarations. */
const NOT_PROGRAM = /[\\/](?:temp|node_modules)[\\/]/;

/**
 * Files whose exports are used from outside the program: the framework reads route and metadata files by
 * name, a module's `index.ts` / `client.ts` / `server.ts` is its public API, and Next.js loads
 * `proxy.ts` and `instrumentation.ts` itself.
 */
const ENTRY_POINTS: readonly RegExp[] = [
  /^src\/app\/.*\/(?:page|layout|route|error|loading|not-found|global-error|default|template)\.tsx?$/,
  /^src\/app\/(?:layout|page|error|loading|not-found|global-error|manifest|robots|sitemap|icon|apple-icon)\.tsx?$/,
  /(?:^|\/)(?:index|client|server)\.ts$/,
  /^src\/(?:proxy|middleware|instrumentation)\.ts$/,
];

/** `/** @keep <reason> *\/`: used by something the compiler cannot see (a string lookup, a framework convention). */
const KEEP = /@keep\s+\S/;

const toPosix = (path: string) => path.replaceAll('\\', '/');

function loadProgram(root: string): ts.Program {
  const configPath = ts.findConfigFile(root, (file) => ts.sys.fileExists(file), 'tsconfig.json');
  if (configPath === undefined) {
    throw new Error(`No tsconfig.json under ${root}`);
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    { incremental: false, noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
  );
  if (parsed === undefined) {
    throw new Error(`Cannot read ${configPath}`);
  }
  const rootNames = parsed.fileNames.filter((file) => !NOT_PROGRAM.test(file));
  return ts.createProgram({ rootNames, options: parsed.options });
}

/** The symbol an identifier stands for, following `import { x }` and `export { x }` to the declaration. */
function symbolOf(checker: ts.TypeChecker, node: ts.Identifier): ts.Symbol | undefined {
  const parent = node.parent;
  const symbol = ts.isShorthandPropertyAssignment(parent)
    ? checker.getShorthandAssignmentValueSymbol(parent)
    : checker.getSymbolAtLocation(node);
  if (symbol === undefined) {
    return undefined;
  }
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** What can introduce a name: the identifier that names one of these is a declaration, not a use. */
const DECLARING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ClassExpression,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.TypeParameter,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

/**
 * The name in `function f` or `import x from`: a declaration, not a use. An `import { f }` and an
 * `export { f }` are uses (an import nothing uses is already a type error), which is also what follows
 * `import { f as g }` back to `f`.
 */
function isBindingName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) {
    return false;
  }
  return (
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isNamespaceExport(parent) ||
    (DECLARING_KINDS.has(parent.kind) && (parent as { name?: ts.Node }).name === node)
  );
}

type Users = Map<ts.Symbol, Map<string, number>>;

function recordUse(users: Users, symbol: ts.Symbol, file: string): void {
  const perFile = users.get(symbol) ?? new Map<string, number>();
  perFile.set(file, (perFile.get(file) ?? 0) + 1);
  users.set(symbol, perFile);
}

interface Candidate {
  readonly symbol: ts.Symbol;
  readonly file: string;
  readonly line: number;
  readonly kind: 'value' | 'type';
}

function hasKeepTag(declaration: ts.Declaration, source: ts.SourceFile): boolean {
  const statement = ts.findAncestor(declaration, ts.isStatement) ?? declaration;
  const ranges = ts.getLeadingCommentRanges(source.text, statement.getFullStart()) ?? [];
  return ranges.some((range) => KEEP.test(source.text.slice(range.pos, range.end)));
}

/** Exports declared in `source` itself (not re-exported from elsewhere), with where they are declared. */
function candidatesOf(checker: ts.TypeChecker, source: ts.SourceFile, rel: string): Candidate[] {
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) {
    return [];
  }
  const found: Candidate[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    if (exported.name === 'default') {
      continue;
    }
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = symbol.declarations?.[0];
    if (declaration?.getSourceFile() !== source) {
      continue;
    }
    if (hasKeepTag(declaration, source)) {
      continue;
    }
    const { line } = source.getLineAndCharacterOfPosition(declaration.getStart());
    found.push({
      symbol,
      file: rel,
      line: line + 1,
      kind: symbol.flags & ts.SymbolFlags.Value ? 'value' : 'type',
    });
  }
  return found;
}

/**
 * Every export of the scoped files, judged by who references it. One pass over the program's syntax with
 * the compiler's own symbol resolution, so path aliases, re-exports through a barrel and `import * as` are
 * followed exactly as the editor's "find all references" does, in seconds rather than minutes.
 */
export function findUnusedExports(options: DeadCodeOptions): ExportFinding[] {
  const root = resolve(options.root);
  const scope = options.scope ?? DEFAULT_SCOPE;
  const testsDir = options.testsDir ?? DEFAULT_TESTS_DIR;
  const program = loadProgram(root);
  const checker = program.getTypeChecker();
  const relOf = (file: string) => toPosix(relative(root, file));

  const sources = program
    .getSourceFiles()
    .filter((file) => !file.isDeclarationFile && !NOT_PROGRAM.test(file.fileName));

  const candidates = sources.flatMap((source) => {
    const rel = relOf(source.fileName);
    const isJudged = rel.startsWith(scope) && !ENTRY_POINTS.some((entry) => entry.test(rel));
    return isJudged ? candidatesOf(checker, source, rel) : [];
  });
  const names = new Set(candidates.map((candidate) => candidate.symbol.name));

  const users: Users = new Map();
  for (const source of sources) {
    const rel = relOf(source.fileName);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && names.has(node.text) && !isBindingName(node)) {
        const symbol = symbolOf(checker, node);
        if (symbol !== undefined) {
          recordUse(users, symbol, rel);
        }
      }
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        // `const { run } = await import('./x')`: the key names an export of x.
        const key = node.propertyName ?? node.name;
        if (ts.isIdentifier(key) && names.has(key.text)) {
          const property = checker.getTypeAtLocation(node.parent).getProperty(key.text);
          if (property !== undefined) {
            recordUse(users, property, rel);
          }
        }
      }
      if (ts.isExportDeclaration(node) && node.exportClause === undefined && node.moduleSpecifier) {
        // `export * from './x'`: every export of x is reached through this file.
        const target = checker.getSymbolAtLocation(node.moduleSpecifier);
        for (const exported of target === undefined ? [] : checker.getExportsOfModule(target)) {
          recordUse(users, exported, rel);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  const findings: ExportFinding[] = [];
  for (const { symbol, file, line, kind } of candidates) {
    const perFile = users.get(symbol) ?? new Map<string, number>();
    const others = [...perFile.keys()].filter((user) => user !== file);
    const fromSource = others.filter((user) => !user.startsWith(testsDir));
    const fromTests = others.filter((user) => user.startsWith(testsDir));
    if (fromSource.length > 0) {
      continue;
    }
    let use: ExportUse = 'dead';
    if (fromTests.length > 0) {
      use = 'test-only';
    } else if (perFile.has(file)) {
      use = 'unneeded-export';
    }
    findings.push({ file, line, name: symbol.name, kind, use });
  }
  return findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name),
  );
}

/** A sentence per finding, in the form editors turn into a link: `file:line  name`. */
export function describeFinding(finding: ExportFinding): string {
  return `${finding.file}:${finding.line}  ${finding.name} (${finding.kind})`;
}
