import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ElasticsearchProvider } from './search/elasticsearch.provider';
import { v2 as cloudinary } from 'cloudinary';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly elasticsearchProvider: ElasticsearchProvider,
  ) {}

  @Get()
  getHello() {
    return {
      status: 'ok',
      message: 'Refrielectricos API is running',
      version: '1.0.0',
      docs: '/api/docs',
      frontend: 'https://refrielectricos-g-e.vercel.app/',
    };
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/db')
  async getHealthDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health/env')
  getHealthEnv() {
    // Debug: show which env vars are present (not their values)
    const vars = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      STORAGE_DATABASE_URL: !!process.env.STORAGE_DATABASE_URL,
      STORAGE_POSTGRES_PRISMA_URL: !!process.env.STORAGE_POSTGRES_PRISMA_URL,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL,
    };
    return {
      status: 'ok',
      envVarsPresent: vars,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/cloudinary')
  async getHealthCloudinary() {
    try {
      await cloudinary.api.ping();
      return {
        status: 'ok',
        cloudinary: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        cloudinary: 'disconnected',
        error,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health/elasticsearch')
  async getHealthElasticsearch() {
    if (!this.elasticsearchProvider.isEnabled()) {
      return {
        status: 'ok',
        elasticsearch: 'disabled',
        reason: 'ELASTICSEARCH_URL not configured or connection unavailable',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      await this.elasticsearchProvider.client?.ping();
      return {
        status: 'ok',
        elasticsearch: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        elasticsearch: 'disconnected',
        error,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health/services')
  async getHealthServices() {
    const cloudinaryHealth = await this.getHealthCloudinary();
    const elasticsearchHealth = await this.getHealthElasticsearch();
    const dbHealth = await this.getHealthDb();

    const isOk =
      cloudinaryHealth.status === 'ok' &&
      elasticsearchHealth.status === 'ok' &&
      dbHealth.status === 'ok';

    return {
      status: isOk ? 'ok' : 'degraded',
      services: {
        database: dbHealth,
        cloudinary: cloudinaryHealth,
        elasticsearch: elasticsearchHealth,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
