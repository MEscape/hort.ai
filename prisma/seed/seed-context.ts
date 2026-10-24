import { logger } from '@lib/logger';

const seedLogger = logger.withContext({ module: 'seed' });

export const tally = {
  created: 0,
  skipped: 0,
};

export function say(message: string): void {
  seedLogger.info(message);
}
