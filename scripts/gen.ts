#!/usr/bin/env tsx
import { COMMANDS } from './commands';
import { CliError } from './lib/args';

function usage(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  return [
    'Usage: npm run gen -- <command> [args] [options]',
    '',
    'Commands:',
    ...Object.entries(COMMANDS).map(
      ([name, command]) => `  ${name.padEnd(width + 2)}${command.summary}`,
    ),
    '',
    'Every command supports --help and --dry-run.',
    'Generators never overwrite existing files: a conflict aborts before anything is written.',
  ].join('\n');
}

async function main(): Promise<void> {
  const [commandName, ...rest] = process.argv.slice(2);

  if (commandName === undefined || commandName === '--help' || commandName === '-h') {
    console.log(usage());
    return;
  }

  const command = Object.hasOwn(COMMANDS, commandName) ? COMMANDS[commandName] : undefined;
  if (command === undefined) {
    console.error(`Unknown command "${commandName}".\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }

  try {
    console.log(await command.run(rest));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

await main();
