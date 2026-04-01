import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchService } from '../search/search.service';
import slugify from 'slugify';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly searchService?: SearchService,
  ) {
    if (!this.prisma) {
      console.error('ProductsService: PrismaService is not initialized!');
    }
  }

  async create(createProductDto: CreateProductDto) {
    console.log('ProductsService: Creating product in DB:', createProductDto);
    try {
      const slug = slugify(createProductDto.name, {
        lower: true,
        strict: true,
      });

      // Verificar si el slug ya existe
      const existingProduct = await this.prisma.product.findUnique({
        where: { slug },
      });

      if (existingProduct) {
        throw new BadRequestException(
          `Product with name "${createProductDto.name}" already exists (slug conflict)`,
        );
      }

      const specificationsValue = createProductDto.specifications
        ? (createProductDto.specifications as unknown as Prisma.InputJsonValue)
        : undefined;

      const product = await this.prisma.product.create({
        data: {
          ...createProductDto,
          slug,
          specifications: specificationsValue,
        },
      });
      console.log('ProductsService: Product created successfully:', product.id);

      // Index to Elasticsearch
      if (this.searchService) {
        await this.searchService.indexProduct(product).catch((err) => {
          console.error('Failed to index product to Elasticsearch:', err);
        });
      }

      return product;
    } catch (error) {
      console.error(
        'ProductsService: Error creating product in Prisma:',
        error,
      );
      throw error;
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      search?: string;
      category?: string;
      subcategory?: string;
      brand?: string;
      minPrice?: number;
      maxPrice?: number;
      sortBy?: 'createdAt' | 'price' | 'name';
      sortOrder?: 'asc' | 'desc';
      isAdmin?: boolean; // If true, show all products including inactive
    },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};

    // Only show active products for storefront (non-admin) requests
    if (!filters?.isAdmin) {
      where.isActive = true;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { subcategory: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.subcategory) {
      where.subcategory = filters.subcategory;
    }

    if (filters?.brand) {
      where.brand = filters.brand;
    }

    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    // Build orderBy clause
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sortBy) {
      case 'price':
        orderBy = { price: sortOrder };
        break;
      case 'name':
        orderBy = { name: sortOrder };
        break;
      case 'createdAt':
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(term: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: term }, { slug: term }],
      },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with term "${term}" not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { specifications, name, ...rest } = updateProductDto;
    const data: Prisma.ProductUpdateInput = { ...rest };

    if (name) {
      data.name = name;
      data.slug = slugify(name, { lower: true, strict: true });
    }

    if (specifications) {
      data.specifications = specifications as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.product
      .update({
        where: { id },
        data,
      })
      .then(async (product) => {
        // Update index in Elasticsearch
        if (this.searchService) {
          await this.searchService.indexProduct(product).catch((err) => {
            console.error('Failed to update product in Elasticsearch:', err);
          });
        }
        return product;
      });
  }

  remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with id "${id}" not found`);
      }

      const orderItemsCount = await tx.orderItem.count({
        where: { productId: id },
      });

      if (orderItemsCount > 0) {
        if (!product.isActive) {
          throw new BadRequestException(
            'Product has related orders and is already inactive, so it cannot be deleted.',
          );
        }

        await tx.product.update({
          where: { id },
          data: { isActive: false },
        });

        return {
          status: 'archived',
          message:
            'The product has historical orders. It was deactivated instead of being permanently deleted.',
        };
      }

      await Promise.all([
        tx.cartItem.deleteMany({ where: { productId: id } }),
        tx.wishlistItem.deleteMany({ where: { productId: id } }),
        tx.review.deleteMany({ where: { productId: id } }),
        tx.question.deleteMany({ where: { productId: id } }),
        tx.productView.deleteMany({ where: { productId: id } }),
      ]);

      // Delete variants (attributes are stored as JSON, no separate table)
      await tx.productVariant.deleteMany({ where: { productId: id } });

      await tx.product.delete({ where: { id } });

      // Delete from Elasticsearch index
      if (this.searchService) {
        await this.searchService.deleteFromIndex(id).catch((err) => {
          console.error('Failed to delete product from Elasticsearch:', err);
        });
      }

      return { status: 'deleted', message: 'Product deleted successfully.' };
    });
  }

  async getMetadata() {
    const grouped = await this.prisma.product.groupBy({
      by: ['category', 'subcategory', 'brand'],
      where: {
        isActive: true,
        category: { not: '' }, // Ensure category is not empty
      },
      orderBy: {
        category: 'asc',
      },
    });

    // Transform into a structured format: Category -> Subcategories[]
    const categoryMap = new Map<string, Set<string>>();

    grouped.forEach((item) => {
      if (!item.category) return;
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, new Set());
      }
      if (item.subcategory) {
        categoryMap.get(item.category).add(item.subcategory);
      }
    });

    const categoriesWithSubcategories = Array.from(categoryMap.entries()).map(
      ([category, subcategoriesSet]) => ({
        name: category,
        subcategories: Array.from(subcategoriesSet).sort(),
      }),
    );

    // Maintain backward compatibility for simple lists if needed,
    // but for now we return the structured data + flat lists
    const allCategories = Array.from(categoryMap.keys()).sort();
    const allBrands = Array.from(
      new Set(grouped.map((g) => g.brand).filter(Boolean)),
    ).sort();

    return {
      categories: allCategories,
      brands: allBrands,
      structure: categoriesWithSubcategories,
    };
  }
  async getSuggestions(term: string) {
    if (!term) return [];

    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: {
        name: true,
        category: true,
        brand: true,
        image_url: true,
        slug: true,
        id: true,
      },
      take: 5,
    });

    return products;
  }

  async getRecommendations(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { category: true, tags: true },
    });

    if (!product) return [];

    return this.prisma.product.findMany({
      where: {
        id: { not: id },
        isActive: true,
        OR: [
          { category: product.category },
          { tags: { hasSome: product.tags } },
        ],
      },
      take: 4,
      orderBy: {
        // Prioritize newer products or maybe random?
        // Prisma doesn't support random easily.
        createdAt: 'desc',
      },
    });
  }

  async findRelated(category: string, excludeId: string) {
    return this.prisma.product.findMany({
      where: {
        category,
        id: { not: excludeId },
        isActive: true,
      },
      take: 4,
    });
  }

  async recordView(productId: string, userId: string) {
    return this.prisma.productView.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        userId,
        productId,
      },
    });
  }
}
