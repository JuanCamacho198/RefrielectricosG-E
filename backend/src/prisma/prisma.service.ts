import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

function getDbUrl(): string {
  const env = process.env;
  return (
    env.STORAGE_POSTGRES_URL_NON_POOLING ||
    env.DATABASE_URL ||
    env.STORAGE_DATABASE_URL ||
    ''
  );
}

function createPrismaClient(): PrismaClient {
  const datasourceUrl = getDbUrl();

  if (!datasourceUrl) {
    throw new Error('Database URL not found in environment variables');
  }

  const adapter = new PrismaNeon({ connectionString: datasourceUrl });
  return new PrismaClient({ adapter });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = getDbUrl();
    if (!datasourceUrl) {
      throw new Error('Database URL not found in environment variables');
    }

    const maskedUrl = datasourceUrl.replace(/\/([^:]+):([^@]+)@/, '/$1:***@');
    const adapter = new PrismaNeon({ connectionString: datasourceUrl });
    super({ adapter });

    this.logger.log(`🔗 Conectando a Neon: ${maskedUrl}`);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(
      '✅ Conexión a base de datos establecida (Neon direct mode).',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
