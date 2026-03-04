import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Resolve the database URL: prefer STORAGE_POSTGRES_PRISMA_URL (Neon pooler),
// fall back to STORAGE_DATABASE_URL, then DATABASE_URL
const dbUrl =
  process.env.STORAGE_POSTGRES_PRISMA_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    'No database URL found. Set STORAGE_POSTGRES_PRISMA_URL, STORAGE_DATABASE_URL, or DATABASE_URL.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url: dbUrl,
  },
});
