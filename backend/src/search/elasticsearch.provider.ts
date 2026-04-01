import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchProvider implements OnModuleInit, OnModuleDestroy {
  public client?: Client;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const elasticsearchUrl =
      this.configService.get<string>('ELASTICSEARCH_URL');
    const elasticsearchApiKey = this.configService.get<string>(
      'ELASTICSEARCH_API_KEY',
    );
    const elasticsearchUsername = this.configService.get<string>(
      'ELASTICSEARCH_USERNAME',
    );
    const elasticsearchPassword = this.configService.get<string>(
      'ELASTICSEARCH_PASSWORD',
    );

    if (!elasticsearchUrl) {
      console.warn(
        'ElasticsearchProvider: ELASTICSEARCH_URL not configured. Search functionality will be disabled.',
      );
      return;
    }

    const clientOptions: ConstructorParameters<typeof Client>[0] = {
      node: elasticsearchUrl,
    };

    // Elastic Cloud normally requires auth (API key or username/password)
    if (elasticsearchApiKey) {
      clientOptions.auth = { apiKey: elasticsearchApiKey };
    } else if (elasticsearchUsername && elasticsearchPassword) {
      clientOptions.auth = {
        username: elasticsearchUsername,
        password: elasticsearchPassword,
      };
    }

    this.client = new Client(clientOptions);

    try {
      await this.client.ping();
      console.log('ElasticsearchProvider: Connected to Elasticsearch');
    } catch (error) {
      console.error(
        'ElasticsearchProvider: Failed to connect to Elasticsearch:',
        error,
      );
      console.warn(
        'ElasticsearchProvider: Continuing without Elasticsearch (fallback mode).',
      );
      this.client = undefined;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  isEnabled(): boolean {
    return !!this.client;
  }

  async createIndexIfNotExists(index: string, mapping: object) {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialized');
    }

    const exists = await this.client.indices.exists({ index });

    if (!exists) {
      await this.client.indices.create({
        index,
        body: mapping,
      });
      console.log(`ElasticsearchProvider: Created index "${index}"`);
    }
  }

  async deleteIndex(index: string) {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialized');
    }

    const exists = await this.client.indices.exists({ index });

    if (exists) {
      await this.client.indices.delete({ index });
      console.log(`ElasticsearchProvider: Deleted index "${index}"`);
    }
  }
}

export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';
