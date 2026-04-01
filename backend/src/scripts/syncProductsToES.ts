import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchProvider } from '../search/elasticsearch.provider';
import { SearchService } from '../search/search.service';
import {
  PRODUCTS_INDEX_NAME,
  PRODUCTS_INDEX_MAPPING,
} from '../search/constants';

async function syncProductsToElasticsearch() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const esProvider = app.get(ElasticsearchProvider);
  const searchService = app.get(SearchService);
  const configService = app.get(ConfigService);

  const indexName =
    configService.get<string>('ELASTICSEARCH_INDEX') || PRODUCTS_INDEX_NAME;

  console.log('🚀 Starting product synchronization to Elasticsearch...');
  console.log(`📊 Index: ${indexName}`);

  // Check if Elasticsearch is configured
  if (!esProvider.isEnabled()) {
    console.error(
      '❌ Elasticsearch is not configured. Please set ELASTICSEARCH_URL environment variable.',
    );
    process.exit(1);
  }

  try {
    // Create index with mapping if it doesn't exist
    await esProvider.createIndexIfNotExists(indexName, PRODUCTS_INDEX_MAPPING);

    // Fetch all active products
    console.log('📥 Fetching products from PostgreSQL...');
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        category: true,
        subcategory: true,
        brand: true,
        image_url: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log(`📦 Found ${products.length} active products`);

    if (products.length === 0) {
      console.log('⚠️ No products to sync');
      return;
    }

    // Bulk index products
    console.log('⬆️ Indexing products to Elasticsearch...');
    await searchService.bulkIndex(products);

    console.log(
      `✅ Successfully synced ${products.length} products to Elasticsearch`,
    );
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run if executed directly
syncProductsToElasticsearch();
