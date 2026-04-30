import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { ProductsService } from './../src/products/products.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  const mockProductsService = {
    findAll: jest.fn().mockReturnValue([{ id: '1', name: 'Test Product' }]),
    findOne: jest.fn().mockReturnValue({ id: '1', name: 'Test Product' }),
    create: jest.fn().mockReturnValue({ id: '1', name: 'New Product' }),
    update: jest.fn().mockReturnValue({ id: '1', name: 'Updated Product' }),
    remove: jest.fn().mockReturnValue({ id: '1', name: 'Deleted Product' }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProductsService)
      .useValue(mockProductsService)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true }) // Mock Auth Guard to allow requests
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  it('/products (GET)', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect([{ id: '1', name: 'Test Product' }]);
  });

  it('/products/:term (GET)', () => {
    return request(app.getHttpServer())
      .get('/products/1')
      .expect(200)
      .expect({ id: '1', name: 'Test Product' });
  });

  it('/products (POST)', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'New Product',
        price: 100,
        description: 'Desc',
        stock: 10,
        category: 'Cat',
        images_url: [],
        tags: [],
      })
      .expect(201)
      .expect({ id: '1', name: 'New Product' });
  });

  afterAll(async () => {
    await app.close();
  });
});
