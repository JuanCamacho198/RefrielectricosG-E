import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { VariantsService } from './variants.service';
import { VariantsController } from './variants.controller';
import { AuditLogsModule } from '../modules/audit-logs/audit-logs.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [AuditLogsModule, SearchModule],
  // VariantsController must be registered BEFORE ProductsController
  // because ProductsController has @Get(':id') which would catch 'variants' as an id
  controllers: [VariantsController, ProductsController],
  providers: [ProductsService, VariantsService],
  exports: [ProductsService, VariantsService],
})
export class ProductsModule {}
