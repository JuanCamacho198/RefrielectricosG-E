import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service';

interface RequestWithUser {
  user: {
    userId: string;
    id?: string;
    name?: string;
    email?: string;
  };
}

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post(':id/view')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  recordView(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.productsService.recordView(id, req.user.userId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async create(@Body() createProductDto: CreateProductDto, @Request() req) {
    console.log(
      'ProductsController: Creating product with data:',
      createProductDto,
    );
    try {
      const product = await this.productsService.create(createProductDto);

      // Log the audit
      await this.auditLogsService.create({
        action: 'CREATE',
        entity: 'Product',
        entityId: product.id,
        newValues: {
          name: product.name,
          price: product.price,
          sku: product.sku,
        },
        userId: req.user?.id,
        userName: req.user?.name,
        userEmail: req.user?.email,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : req.headers['user-agent'],
      });

      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Internal Server Error';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'subcategory', required: false, type: String })
  @ApiQuery({ name: 'brand', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Field to sort by: createdAt, price, name',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: String,
    description: 'Sort order: asc or desc',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive products (admin only)',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('subcategory') subcategory?: string,
    @Query('brand') brand?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.productsService.findAll(page, limit, {
      search,
      category,
      subcategory,
      brand,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sortBy: sortBy as 'createdAt' | 'price' | 'name' | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      isAdmin: includeInactive === 'true',
    });
  }

  @Get('metadata')
  getMetadata() {
    return this.productsService.getMetadata();
  }

  @Get('suggestions')
  getSuggestions(@Query('term') term: string) {
    return this.productsService.getSuggestions(term);
  }

  @Get(':id/recommendations')
  getRecommendations(@Param('id') id: string) {
    return this.productsService.getRecommendations(id);
  }

  @Get('related')
  findRelated(
    @Query('category') category: string,
    @Query('excludeId') excludeId: string,
  ) {
    return this.productsService.findRelated(category, excludeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req,
  ) {
    try {
      // Get old product values for audit
      const oldProduct = await this.productsService.findOne(id);

      const updatedProduct = await this.productsService.update(
        id,
        updateProductDto,
      );

      // Log changes
      const changes: Record<string, any> = {};
      Object.keys(updateProductDto).forEach((key) => {
        if (oldProduct[key] !== updatedProduct[key]) {
          changes[key] = {
            old: oldProduct[key],
            new: updatedProduct[key],
          };
        }
      });

      if (Object.keys(changes).length > 0) {
        await this.auditLogsService.log('UPDATE', 'Product', id, changes, req);
      }

      return updatedProduct;
    } catch (error) {
      console.error(`Error updating product ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async remove(@Param('id') id: string, @Request() req) {
    const product = await this.productsService.findOne(id);

    const result = await this.productsService.remove(id);

    // Log deletion
    await this.auditLogsService.create({
      action: 'DELETE',
      entity: 'Product',
      entityId: id,
      oldValues: { name: product.name, sku: product.sku },
      userId: req.user?.id,
      userName: req.user?.name,
      userEmail: req.user?.email,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
    });

    return result;
  }
}
