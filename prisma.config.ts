import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadEnv({ path: ['.env', '.env.example'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['public.user_info'],
  },
});
