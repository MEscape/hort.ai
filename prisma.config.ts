import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: './prisma/schema.prisma',
    output: './src/lib/db',
    db: {
      connection: process.env['DATABASE_URL']!,
    },
    migrations: {
      dir: './prisma/migrations',
    },
  }),
});
