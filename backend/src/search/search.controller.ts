import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  SearchService,
  SearchResult,
  AutocompleteResult,
} from './search.service';
import { SearchQueryDto, AutocompleteQueryDto } from './dto/search.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search products with relevance ranking' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results with pagination' })
  async search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    const { q, page = 1, limit = 10 } = query;

    if (!q) {
      return {
        products: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
    }

    return this.searchService.search(q, page, limit);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Get autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions' })
  async autocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<AutocompleteResult> {
    const { q, limit = 5 } = query;

    if (!q || q.length < 2) {
      return {
        suggestions: [],
        products: [],
      };
    }

    return this.searchService.autocomplete(q, limit);
  }
}
