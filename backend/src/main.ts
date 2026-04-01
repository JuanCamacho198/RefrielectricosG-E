import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';
import {
  HttpExceptionFilter,
  PrismaExceptionFilter,
  AllExceptionsFilter,
} from './common/filters';

async function bootstrap() {
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          process.env.NODE_ENV === 'production'
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.printf((info) => {
                  // eslint-disable-next-line @typescript-eslint/no-base-to-string
                  const ts = String(info.timestamp ?? '');
                  // eslint-disable-next-line @typescript-eslint/no-base-to-string
                  const ctx = String(info.context ?? 'Application');

                  const lvl = String(info.level ?? 'info');
                  // eslint-disable-next-line @typescript-eslint/no-base-to-string
                  const msg = String(info.message ?? '');
                  // eslint-disable-next-line @typescript-eslint/no-base-to-string
                  const msVal = String(info.ms ?? '');
                  return `${ts} [${ctx}] ${lvl}: ${msg} ${msVal}`;
                }),
              ),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });

  // 1. CONFIGURACIÓN CRÍTICA DE HELMET
  // Por defecto helmet bloquea recursos cross-origin. Hay que permitirlo.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api');

  // Global Exception Filters (order matters - most specific to most general)
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Changed from true to false to prevent errors on extra fields
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 2. CONFIGURACIÓN DE CORS
  const allowedOrigins = [
    'https://frontend-production-4178.up.railway.app',
    'https://paginawebrefrielectricos-v2-production.up.railway.app', // Self
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000',
    'http://localhost:4001',
  ].filter((url): url is string => !!url);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,Accept',
  });

  const config = new DocumentBuilder()
    .setTitle('Refrielectricos API')
    .setDescription('API para el eCommerce de Refrielectricos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 4000;
  // 3. ESCUCHAR EN 0.0.0.0 (Obligatorio para Railway)
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
