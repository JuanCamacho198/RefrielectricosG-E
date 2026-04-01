import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { ConfigService } from '@nestjs/config';

const mockElasticsearchProvider = {
  isEnabled: jest.fn(),
  client: {
    index: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    bulk: jest.fn(),
    close: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'ELASTICSEARCH_INDEX') return 'products';
    return null;
  }),
};

describe('SearchService', () => {
  let service: SearchService;
  let esProvider: ElasticsearchProvider;
  let esClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ElasticsearchProvider,
          useValue: mockElasticsearchProvider,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    esProvider = module.get<ElasticsearchProvider>(ElasticsearchProvider);
    esClient = mockElasticsearchProvider.client;

    jest.clearAllMocks();
    mockElasticsearchProvider.isEnabled.mockReturnValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('indexProduct', () => {
    it('should index a product to Elasticsearch', async () => {
      const product = {
        id: 'prod-1',
        name: 'Compresor Industrial',
        slug: 'compresor-industrial',
        description: 'Potente compresor',
        price: 500,
        category: 'Compresores',
        subcategory: 'Industrial',
        brand: 'Samsung',
        image_url: 'https://example.com/img.jpg',
        isActive: true,
        createdAt: new Date(),
      };

      await service.indexProduct(product);

      expect(esClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod-1',
        document: expect.objectContaining({
          id: 'prod-1',
          name: 'Compresor Industrial',
        }),
      });
    });

    it('should skip indexing if Elasticsearch not configured', async () => {
      mockElasticsearchProvider.isEnabled.mockReturnValue(false);

      const product = { id: 'prod-1', name: 'Test' };
      await service.indexProduct(product as any);

      expect(esClient.index).not.toHaveBeenCalled();
    });
  });

  describe('deleteFromIndex', () => {
    it('should delete a product from Elasticsearch', async () => {
      await service.deleteFromIndex('prod-1');

      expect(esClient.delete).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod-1',
      });
    });

    it('should handle 404 errors gracefully', async () => {
      esClient.delete.mockRejectedValueOnce({
        meta: { statusCode: 404 },
      });

      await expect(service.deleteFromIndex('prod-1')).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    it('should return search results with pagination', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            { _source: { id: 'prod-1', name: 'Compresor' }, _score: 2.5 },
            { _source: { id: 'prod-2', name: 'Compresor Mini' }, _score: 1.5 },
          ],
        },
      });

      const result = await service.search('compresor', 1, 10);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.products[0].name).toBe('Compresor');
    });

    it('should throw error if Elasticsearch not configured', async () => {
      mockElasticsearchProvider.isEnabled.mockReturnValue(false);

      await expect(service.search('test')).rejects.toThrow(
        'Elasticsearch not configured',
      );
    });

    it('should sort results by score', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [{ _source: { id: 'prod-1' }, _score: 1.0 }],
        },
      });

      await service.search('test');

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: expect.arrayContaining([
            expect.objectContaining({ _score: { order: 'desc' } }),
          ]),
        }),
      );
    });
  });

  describe('autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            { _source: { id: 'prod-1', name: 'Compresor 500HP' } },
            { _source: { id: 'prod-2', name: 'Compresor 200HP' } },
          ],
        },
      });

      const result = await service.autocomplete('comp', 5);

      expect(result.suggestions).toHaveLength(2);
      expect(result.products).toHaveLength(2);
    });

    it('should return empty for short prefixes', async () => {
      const result = await service.autocomplete('c', 5);

      expect(result.suggestions).toHaveLength(0);
      expect(result.products).toHaveLength(0);
      expect(esClient.search).not.toHaveBeenCalled();
    });

    it('should throw error if Elasticsearch not configured', async () => {
      mockElasticsearchProvider.isEnabled.mockReturnValue(false);

      await expect(service.autocomplete('test')).rejects.toThrow(
        'Elasticsearch not configured',
      );
    });
  });

  describe('bulkIndex', () => {
    it('should bulk index multiple products', async () => {
      esClient.bulk.mockResolvedValueOnce({
        errors: false,
        items: [],
      });

      const products = [
        {
          id: 'prod-1',
          name: 'Product 1',
          slug: 'p1',
          price: 100,
          category: 'A',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          slug: 'p2',
          price: 200,
          category: 'B',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      await service.bulkIndex(products as any);

      expect(esClient.bulk).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({
              index: { _index: 'products', _id: 'prod-1' },
            }),
            expect.objectContaining({
              index: { _index: 'products', _id: 'prod-2' },
            }),
          ]),
        }),
      );
    });
  });
});
