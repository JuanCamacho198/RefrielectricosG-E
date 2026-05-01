import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ElasticsearchProvider } from './search/elasticsearch.provider';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue(1),
    };

    const elasticMock = {
      isEnabled: jest.fn().mockReturnValue(false),
      client: undefined,
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ElasticsearchProvider, useValue: elasticMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API metadata', () => {
      expect(appController.getHello()).toMatchObject({
        status: 'ok',
        message: 'Refrielectricos API is running',
      });
    });
  });
});
