import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [ConfigModule],
  providers: [ElasticsearchProvider, SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
