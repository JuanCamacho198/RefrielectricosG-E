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

neonConfig.webSocketConstructor = ws as any;

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

  constructor() {
    const connectionString =
      process.env.STORAGE_POSTGRES_PRISMA_URL ||
      process.env.STORAGE_DATABASE_URL ||
      process.env.DATABASE_URL;

    const options: any = {};
    if (connectionString && isNeonConnectionString(connectionString)) {
      const pool = new Pool({ connectionString });
      options.adapter = new PrismaNeon(pool as any);
      // When using a Driver Adapter, do NOT set datasourceUrl — the adapter manages the connection
    } else if (connectionString) {
      // Non-Neon URL (e.g., Railway, local) — use standard Prisma connection
      options.datasourceUrl = connectionString;
    }
    super(options);
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    const MAX_RETRIES = 3; // 3 intentos (Vercel has a 10s timeout on Hobby)
    const RETRY_DELAY = 2000; // 2 segundos entre intentos

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await this.$connect();
        this.logger.log(
          '✅ Conexión a base de datos (Neon Serverless) establecida.',
        );
        return; // Salir de la función si conecta
      } catch (error) {
        this.logger.warn(
          `⚠️ Intento ${i + 1}/${MAX_RETRIES} fallido. La DB puede estar despertando. Reintentando en 3s...`,
        );

        // Si es el último intento, lanzamos el error para que ahora sí falle
        if (i === MAX_RETRIES - 1) {
          this.logger.error(
            '❌ No se pudo conectar a la DB tras múltiples intentos.',
          );
          throw error;
        }

        // Esperar X segundos antes de intentar de nuevo (Mantiene el proceso vivo)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
}
