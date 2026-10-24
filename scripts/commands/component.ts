import { CliError, formatHelp, parseArgs } from '../lib/args';
import { PATHS } from '../lib/config';
import { formatSource } from '../lib/format';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';
import { assertKebabName, toPascal } from '../lib/names';

import type { FlagSpecs } from '../lib/args';

export const COMPONENT_FLAGS = {
  module: {
    type: 'string',
    description: 'Owning module. Omit for a shared composite.',
    alias: 'm',
  },
  client: {
    type: 'boolean',
    description: 'Mark it "use client" (only for state, effects or browser APIs).',
    default: false,
  },
  tests: { type: 'boolean', description: 'Generate a render test.', default: true },
  'dry-run': {
    type: 'boolean',
    description: 'Validate and list the files without writing.',
    default: false,
  },
  help: { type: 'boolean', description: 'Show this help.', alias: 'h', default: false },
} as const satisfies FlagSpecs;

const HELP = formatHelp(
  'npm run gen -- component <name> [-m <module>] [--client]',
  'Add a UI component: a shared composite in src/components/shared, or a module component in presentation/components.',
  COMPONENT_FLAGS,
  [
    'npm run gen -- component info-banner',
    'npm run gen -- component item-summary -m inventory',
    'npm run gen -- component confirm-dialog --client',
  ],
);

function componentSource(pascal: string, client: boolean): string {
  return `${client ? "'use client';\n\n" : ''}import type { ComponentProps } from 'react';

export type ${pascal}Props = ComponentProps<'div'>;

/** Placeholder markup: replace it, and narrow the props to what this component needs. */
export function ${pascal}({ children, ...props }: ${pascal}Props) {
  return <div {...props}>{children}</div>;
}
`;
}

function testSource(pascal: string, importPath: string): string {
  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ${pascal} } from '${importPath}';

describe('${pascal}', () => {
  it('renders its children', () => {
    render(<${pascal}>content</${pascal}>);

    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
`;
}

export async function runComponent(
  argv: string[],
  options: { root?: string } = {},
): Promise<string> {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, COMPONENT_FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }
  const [rawName, ...extra] = positionals;
  if (rawName === undefined) {
    throw new CliError(`Missing component name.\n\n${HELP}`);
  }
  if (extra.length > 0) {
    throw new CliError(`Unexpected argument "${extra[0]}".`);
  }

  const kebab = assertKebabName(rawName, 'component name');
  const pascal = toPascal(kebab);
  const moduleDir =
    typeof flags['module'] === 'string'
      ? assertKebabName(flags['module'], 'module name')
      : undefined;

  const plan = new Plan(root);
  let file: string;
  let testFile: string;
  let importPath: string;
  if (moduleDir === undefined) {
    file = `${PATHS.sharedComponents}/${kebab}.tsx`;
    testFile = `${PATHS.sharedComponentTests}/${kebab}.test.tsx`;
    importPath = `@components/shared/${kebab}`;
  } else {
    if (!plan.exists(`${PATHS.modules}/${moduleDir}`)) {
      throw new CliError(`Module "${moduleDir}" not found at ${PATHS.modules}/${moduleDir}.`);
    }
    file = `${PATHS.modules}/${moduleDir}/presentation/components/${kebab}.tsx`;
    testFile = `${PATHS.moduleTests}/${moduleDir}/${kebab}.test.tsx`;
    importPath = `@modules/${moduleDir}/presentation/components/${kebab}`;
  }

  plan.create(
    file,
    await formatSource(root, file, componentSource(pascal, flags['client'] === true)),
  );
  if (flags['tests'] !== false) {
    plan.create(testFile, await formatSource(root, testFile, testSource(pascal, importPath)));
  }

  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });
  return [
    formatSummary(summary, dryRun),
    '',
    'Next steps (docs/conventions/adding-a-ui-component.md):',
    '1. Compose existing primitives from src/components/ui before building new markup; style with design tokens.',
    '2. Take all user-facing text from translations (`gen translation`), and give interactive elements accessible names.',
    '3. Handle loading, empty and error states; test through user interaction, querying by role.',
  ].join('\n');
}
