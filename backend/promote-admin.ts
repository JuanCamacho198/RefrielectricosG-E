import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const dbUrl =
  process.env.STORAGE_POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaNeon(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Checking all users in database...`);

  const users = await prisma.user.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { email: true, role: true, id: true, createdAt: true },
  });
  console.log('Found users (last 20 created):');
  users.forEach((u) => console.log(`  - ${u.email} (${u.role})`));

  // Search for specific users
  const specificEmails = [
    'qatest_admin@test.com',
    'jdavidcamacho503@gmail.com',
    'jcamachomolina504@gmail.com',
  ];

  for (const email of specificEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    console.log(
      `\nUser ${email}: ${user ? `EXISTS (${user.role})` : 'NOT FOUND'}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
