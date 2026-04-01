/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SearchService } from '../search/search.service';

const mockPrismaService = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockPrismaService)),
};

const mockSearchService = {
  indexProduct: jest.fn().mockResolvedValue(undefined),
  deleteFromIndex: jest.fn().mockResolvedValue(undefined),
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let searchService: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    searchService = module.get<SearchService>(SearchService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const dto = {
        name: 'Test Product',
        price: 100,
        description: 'Test Description',
        stock: 10,
        category: 'Test Category',
        images_url: [],
        tags: [],
      };

      const expectedProduct = {
        id: '1',
        ...dto,
        slug: 'test-product',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(expectedProduct);

      const result = await service.create(dto);
      expect(result).toEqual(expectedProduct);
      expect(prisma.product.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if slug exists', async () => {
      const dto = {
        name: 'Test Product',
        price: 100,
        description: 'Test Description',
        stock: 10,
        category: 'Test Category',
        images_url: [],
        tags: [],
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of products', async () => {
      const products = [{ id: '1', name: 'Product 1' }];
      (prisma.product.findMany as jest.Mock).mockResolvedValue(products);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll();
      expect(result.data).toEqual(products);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const product = { id: '1', name: 'Product 1' };
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(product);

      const result = await service.findOne('1');
      expect(result).toEqual(product);
    });

    it('should throw NotFoundException if product not found', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
