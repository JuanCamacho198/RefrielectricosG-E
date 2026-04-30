import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment } = createReviewDto;

    // 1. Verificar si el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // 2. Verificar si el usuario ya dejó una reseña
    const existingReview = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    if (existingReview) {
      throw new ConflictException('Ya has valorado este producto');
    }

    // 3. Verificar elegibilidad (haber comprado y recibido el producto)
    const hasPurchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'DELIVERED', // Solo si ya fue entregado
        items: {
          some: {
            productId,
          },
        },
      },
    });

    if (!hasPurchased) {
      throw new BadRequestException(
        'Debes haber comprado y recibido el producto para dejar una reseña',
      );
    }

    // 4. Crear reseña
    return this.prisma.review.create({
      data: {
        userId,
        productId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAllByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkEligibility(userId: string, productId: string) {
    const hasPurchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'DELIVERED',
        items: {
          some: {
            productId,
          },
        },
      },
    });

    const existingReview = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return {
      canReview: !!hasPurchased && !existingReview,
      hasPurchased: !!hasPurchased,
      hasReviewed: !!existingReview,
    };
  }

  async findAllByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image_url: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingByUser(userId: string) {
    // 1. Get all delivered orders
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'DELIVERED',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image_url: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // 2. Extract all products
    const purchasedProducts = new Map();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        purchasedProducts.set(item.productId, item.product);
      });
    });

    // 3. Get existing reviews
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      select: { productId: true },
    });

    const reviewedProductIds = new Set(reviews.map((r) => r.productId));

    // 4. Filter out reviewed products
    const pendingProducts: any[] = [];
    for (const [productId, product] of purchasedProducts) {
      if (!reviewedProductIds.has(productId as string)) {
        pendingProducts.push(product);
      }
    }

    return pendingProducts;
  }
}
