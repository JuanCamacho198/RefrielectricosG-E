import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
