import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/create-variant.dto';
import slugify from 'slugify';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique slug for a variant
   */
  private async generateUniqueSlug(
    productSlug: string,
    variantName: string,
    excludeId?: string,
  ): Promise<string> {
    // Generate variant name slug
    const variantSlug = slugify(variantName, {
      lower: true,
      strict: true,
    });

    // If the variant slug is the same as the product slug (e.g., same name),
    // use a numeric suffix instead to avoid duplication
    let baseSlug: string;
    if (variantSlug === productSlug || !variantSlug) {
      baseSlug = `${productSlug}-variante`;
    } else if (variantSlug.startsWith(productSlug)) {
      // If variant already starts with product slug, don't duplicate
      baseSlug = variantSlug;
    } else {
      baseSlug = `${productSlug}-${variantSlug}`;
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.productVariant.findUnique({
        where: { slug },
      });

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Create a new variant for a product
   */
  async create(productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const slug =
      dto.slug || (await this.generateUniqueSlug(product.slug, dto.name));

    // Check for SKU uniqueness if provided
    if (dto.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku },
      });
      if (existingSku) {
        throw new BadRequestException(`SKU "${dto.sku}" already exists`);
      }
    }

    // If this is the first variant or marked as default, ensure only one default
    if (dto.isDefault) {
      await this.prisma.productVariant.updateMany({
        where: { productId },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        slug,
        sku: dto.sku,
        price: dto.price,
        originalPrice: dto.originalPrice,
        stock: dto.stock,
        image_url: dto.image_url,
        images_url: dto.images_url || [],
        attributes: dto.attributes,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });

    // Mark product as having variants
    await this.prisma.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    return variant;
  }

  /**
   * Get all variants for a product
   */
  async findByProduct(productId: string, includeInactive = false) {
    const where: Prisma.ProductVariantWhereInput = { productId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return await this.prisma.productVariant.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a single variant by ID or slug
   */
  async findOne(term: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        OR: [{ id: term }, { slug: term }],
      },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Variant "${term}" not found`);
    }

    return variant;
  }

  /**
   * Get variant by slug with full product data and sibling variants
   */
  async findBySlugWithProduct(slug: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { slug },
      include: {
        product: {
          include: {
            variants: {
              where: { isActive: true },
              orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
            },
            reviews: {
              select: {
                rating: true,
              },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with slug "${slug}" not found`);
    }

    return variant;
  }

  /**
   * Update a variant
   */
  async update(id: string, dto: UpdateVariantDto) {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!existing) {
      throw new NotFoundException(`Variant with ID "${id}" not found`);
    }

    const data: Prisma.ProductVariantUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      // Regenerate slug if name changes
      data.slug = await this.generateUniqueSlug(
        existing.product.slug,
        dto.name,
        id,
      );
    }

    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }

    if (dto.sku !== undefined) {
      if (dto.sku) {
        const existingSku = await this.prisma.productVariant.findFirst({
          where: { sku: dto.sku, NOT: { id } },
        });
        if (existingSku) {
          throw new BadRequestException(`SKU "${dto.sku}" already exists`);
        }
      }
      data.sku = dto.sku;
    }

    if (dto.price !== undefined) data.price = dto.price;
    if (dto.originalPrice !== undefined) data.originalPrice = dto.originalPrice;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.image_url !== undefined) data.image_url = dto.image_url;
    if (dto.images_url !== undefined) data.images_url = dto.images_url;
    if (dto.attributes !== undefined) data.attributes = dto.attributes;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.position !== undefined) data.position = dto.position;

    // Handle default flag
    if (dto.isDefault === true) {
      await this.prisma.productVariant.updateMany({
        where: { productId: existing.productId, NOT: { id } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (dto.isDefault === false) {
      data.isDefault = false;
    }

    return this.prisma.productVariant.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a variant
   */
  async remove(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID "${id}" not found`);
    }

    await this.prisma.productVariant.delete({
      where: { id },
    });

    // Check if product still has variants
    const remainingVariants = await this.prisma.productVariant.count({
      where: { productId: variant.productId },
    });

    if (remainingVariants === 0) {
      await this.prisma.product.update({
        where: { id: variant.productId },
        data: { hasVariants: false },
      });
    }

    return { message: 'Variant deleted successfully' };
  }

  /**
   * Bulk create variants for a product
   */
  async bulkCreate(productId: string, variants: CreateVariantDto[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const results: Awaited<
      ReturnType<typeof this.prisma.productVariant.create>
    >[] = [];
    let hasDefault = false;

    for (const dto of variants) {
      const slug = await this.generateUniqueSlug(product.slug, dto.name);

      // Only first variant marked as default, or first variant if none specified
      const isDefault = dto.isDefault || (!hasDefault && results.length === 0);
      if (isDefault) hasDefault = true;

      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          name: dto.name,
          slug,
          sku: dto.sku,
          price: dto.price,
          originalPrice: dto.originalPrice,
          stock: dto.stock,
          image_url: dto.image_url,
          images_url: dto.images_url || [],
          attributes: dto.attributes,
          isDefault,
          isActive: dto.isActive ?? true,
          position: dto.position ?? results.length,
        },
      });

      results.push(variant);
    }

    // Mark product as having variants
    if (results.length > 0) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      });
    }

    return results;
  }
}
