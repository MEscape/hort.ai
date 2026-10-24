import { runComponent } from './component';
import { runEnv } from './env';
import { runModule } from './module';
import { runTranslation } from './translation';
import { runUseCase } from './usecase';

export interface Command {
  readonly summary: string;
  /** The convention document this command automates. */
  readonly convention: string;
  readonly run: (argv: string[]) => Promise<string>;
}

/** Every `npm run gen -- <command>`: the registry `gen.ts` dispatches on and the tests check against the docs. */
export const COMMANDS: Record<string, Command> = {
  module: {
    summary:
      'Scaffold a business module (domain, application, infrastructure, presentation, tests)',
    convention: 'docs/conventions/adding-a-module.md',
    run: (argv) => runModule(argv),
  },
  usecase: {
    summary: 'Add one command or query to an existing module',
    convention: 'docs/conventions/adding-a-use-case.md',
    run: (argv) => runUseCase(argv),
  },
  component: {
    summary: 'Add a UI component (shared composite or module component) with a render test',
    convention: 'docs/conventions/adding-a-ui-component.md',
    run: (argv) => runComponent(argv),
  },
  env: {
    summary: 'Add an environment variable to .env.example and print its schema line',
    convention: 'docs/conventions/adding-an-environment-variable.md',
    run: (argv) => Promise.resolve(runEnv(argv)),
  },
  translation: {
    summary: 'Add one message to every locale at once',
    convention: 'docs/conventions/adding-a-translation.md',
    run: (argv) => Promise.resolve(runTranslation(argv)),
  },
};
