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

async function setupApp(app: any) {
  const logger = WinstonModule.createLogger({
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
    transports: [new winston.transports.Console()],
  });

  app.useLogger(logger);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const allowedOrigins = [
    'https://frontend-production-4178.up.railway.app',
    'https://paginawebrefrielectricos-v2-production.up.railway.app',
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
}

let cachedApp: any;

async function getApp() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);
    await setupApp(app);
    await app.init();
    cachedApp = app.getHttpAdapter().getInstance();
  }
  return cachedApp;
}

// Handler para Vercel
export default async (req: any, res: any) => {
  const handler = await getApp();
  handler(req, res);
};

// Bootstrap para desarrollo local o Railway
async function bootstrap() {
  if (!process.env.VERCEL) {
    const app = await NestFactory.create(AppModule);
    await setupApp(app);
    const port = process.env.PORT ?? 4000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
  }
}

void bootstrap();
