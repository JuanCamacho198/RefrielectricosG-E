import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl =
      process.env.STORAGE_POSTGRES_PRISMA_URL ||
      process.env.STORAGE_DATABASE_URL ||
      process.env.DATABASE_URL;

    if (!datasourceUrl) {
      throw new Error('Database URL not found in environment variables');
    }

    const pool = new Pool({ connectionString: datasourceUrl });
    const adapter = new PrismaNeon(pool as any);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Conexión a base de datos establecida (Neon adapter).');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
