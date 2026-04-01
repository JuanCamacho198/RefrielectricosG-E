import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { PRODUCTS_INDEX_NAME } from './constants';

export const SEARCH_SERVICE_TOKEN = 'SEARCH_SERVICE';

export interface SearchResult {
  products: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AutocompleteResult {
  suggestions: string[];
  products: { id: string; name: string }[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly elasticsearchProvider: ElasticsearchProvider,
    private readonly configService: ConfigService,
  ) {}

  private get client(): Client | null {
    return this.elasticsearchProvider.isEnabled()
      ? this.elasticsearchProvider.client
      : null;
  }

  private get indexName(): string {
    return (
      this.configService.get<string>('ELASTICSEARCH_INDEX') ||
      PRODUCTS_INDEX_NAME
    );
  }

  async indexProduct(product: any): Promise<void> {
    if (!this.client) {
      this.logger.warn('Elasticsearch not configured. Skipping indexing.');
      return;
    }

    try {
      await this.client.index({
        index: this.indexName,
        id: product.id,
        document: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          category: product.category,
          subcategory: product.subcategory,
          brand: product.brand,
          image_url: product.image_url,
          isActive: product.isActive,
          createdAt: product.createdAt,
        },
      });
      this.logger.log(`Indexed product ${product.id}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}:`, error);
      throw error;
    }
  }

  async deleteFromIndex(productId: string): Promise<void> {
    if (!this.client) {
      this.logger.warn('Elasticsearch not configured. Skipping deletion.');
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: productId,
      });
      this.logger.log(`Deleted product ${productId} from index`);
    } catch (error: any) {
      // Ignore if document doesn't exist
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(`Product ${productId} not found in index`);
        return;
      }
      this.logger.error(
        `Failed to delete product ${productId} from index:`,
        error,
      );
      throw error;
    }
  }

  async search(
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<SearchResult> {
    if (!this.client) {
      throw new Error('Elasticsearch not configured');
    }

    const from = (page - 1) * limit;

    try {
      const result = await this.client.search({
        index: this.indexName,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query,
                  fields: [
                    'name^3',
                    'brand^2',
                    'description^1',
                    'category^1',
                    'subcategory^1',
                  ],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [
              {
                term: {
                  isActive: true,
                },
              },
            ],
          },
        },
        from,
        size: limit,
        sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      });

      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : result.hits.total?.value || 0;

      const products = result.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      }));

      return {
        products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Search failed for query "${query}":`, error);
      throw error;
    }
  }

  async autocomplete(
    prefix: string,
    limit: number = 5,
  ): Promise<AutocompleteResult> {
    if (!this.client) {
      throw new Error('Elasticsearch not configured');
    }

    if (!prefix || prefix.length < 2) {
      return { suggestions: [], products: [] };
    }

    try {
      // Use prefix query for autocomplete
      const result = await this.client.search({
        index: this.indexName,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: prefix,
                  fields: ['name.autocomplete^3', 'brand^2', 'category^1'],
                  type: 'phrase_prefix',
                },
              },
            ],
            filter: [
              {
                term: {
                  isActive: true,
                },
              },
            ],
          },
        },
        size: limit,
        _source: ['id', 'name'],
      });

      const products = result.hits.hits.map((hit: any) => ({
        id: hit._source.id,
        name: hit._source.name,
      }));

      // Extract unique suggestions
      const suggestions = [...new Set(products.map((p: any) => p.name))].slice(
        0,
        limit,
      );

      return {
        suggestions,
        products,
      };
    } catch (error) {
      this.logger.error(`Autocomplete failed for prefix "${prefix}":`, error);
      throw error;
    }
  }

  async bulkIndex(products: any[]): Promise<void> {
    if (!this.client) {
      throw new Error('Elasticsearch not configured');
    }

    const operations = products.flatMap((product) => [
      { index: { _index: this.indexName, _id: product.id } },
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        category: product.category,
        subcategory: product.subcategory,
        brand: product.brand,
        image_url: product.image_url,
        isActive: product.isActive,
        createdAt: product.createdAt,
      },
    ]);

    try {
      const result = await this.client.bulk({ operations, refresh: true });

      if (result.errors) {
        const erroredDocuments = result.items.filter(
          (item: any) => item.index?.error,
        );
        this.logger.error(
          `Bulk indexing errors: ${erroredDocuments.length} documents failed`,
        );
      }

      this.logger.log(`Bulk indexed ${products.length} products`);
    } catch (error) {
      this.logger.error('Bulk indexing failed:', error);
      throw error;
    }
  }
}
