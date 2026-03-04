import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Use the pooler URL (PgBouncer) for serverless compatibility.
    // The Neon pooler handles connection management at the infrastructure level,
    // so we don't need the @prisma/adapter-neon WebSocket driver here.
    const datasourceUrl =
      process.env.STORAGE_POSTGRES_PRISMA_URL ||
      process.env.STORAGE_DATABASE_URL ||
      process.env.DATABASE_URL;

    super({ datasourceUrl });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Conexión a base de datos establecida (Neon pooler).');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
