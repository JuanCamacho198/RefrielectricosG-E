import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as ws from 'ws';

// In serverless environments (Vercel), WebSocket connections may not work reliably.
// Use the `ws` polyfill only when a WebSocket constructor is not globally available.
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws as any;
}
// Optimize for serverless: disable connection caching to avoid stale connections
neonConfig.poolQueryViaFetch = true;

function isNeonConnectionString(url: string): boolean {
  return (
    url.includes('neon.tech') ||
    url.includes('neon.database') ||
    url.includes('neondb')
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly usingNeonAdapter: boolean;

  constructor() {
    const connectionString =
      process.env.STORAGE_POSTGRES_PRISMA_URL ||
      process.env.STORAGE_DATABASE_URL ||
      process.env.DATABASE_URL;

    const options: any = {};
    let usingNeon = false;

    if (connectionString && isNeonConnectionString(connectionString)) {
      const pool = new Pool({ connectionString });
      options.adapter = new PrismaNeon(pool as any);
      // When using a Driver Adapter, do NOT set datasourceUrl — the adapter manages the connection
      usingNeon = true;
    } else if (connectionString) {
      // Non-Neon URL (e.g., Railway, local) — use standard Prisma connection
      options.datasourceUrl = connectionString;
    }
    super(options);
    this.usingNeonAdapter = usingNeon;
  }

  async onModuleInit() {
    if (this.usingNeonAdapter) {
      // With Neon Driver Adapter, connections are managed lazily per-query.
      // Calling $connect() is unnecessary and may cause issues in serverless environments.
      this.logger.log(
        '✅ Prisma con Neon Driver Adapter listo (conexiones gestionadas por pool).',
      );
    } else {
      await this.connectWithRetry();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await this.$connect();
        this.logger.log('✅ Conexión a base de datos establecida.');
        return;
      } catch (error) {
        this.logger.warn(
          `⚠️ Intento ${i + 1}/${MAX_RETRIES} fallido. Reintentando en ${RETRY_DELAY}ms...`,
        );

        if (i === MAX_RETRIES - 1) {
          this.logger.error(
            '❌ No se pudo conectar a la DB tras múltiples intentos.',
          );
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
}
