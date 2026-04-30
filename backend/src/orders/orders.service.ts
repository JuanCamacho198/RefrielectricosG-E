import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailService } from '../modules/email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import type { Product, Order } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly couponsService: CouponsService,
    private readonly emailService: EmailService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<any> {
    const { userId, items, status, addressId, notes, couponCode } =
      createOrderDto;

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verificar dirección
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException(
        `Address with ID ${addressId} not found or does not belong to user`,
      );
    }

    if (!items || items.length === 0) {
      throw new NotFoundException('Order must contain at least one item');
    }

    // Obtener todos los productos involucrados en una sola consulta
    const productIds = items.map((it) => it.productId);
    const products: Product[] = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productsMap = new Map(products.map((p: Product) => [p.id, p]));

    // Preparar los datos de los items y calcular subtotal
    let subtotal = 0;
    const orderItemsData: {
      productId: string;
      quantity: number;
      price: number;
    }[] = [];

    for (const item of items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      // Aquí podríamos verificar stock y lanzar error si no hay suficiente
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Validar y aplicar cupón si se proporciona
    let total = subtotal;
    let discountAmount = 0;
    let couponId: string | null = null;

    if (couponCode) {
      const validation = await this.couponsService.validateCoupon({
        code: couponCode,
        cartTotal: subtotal,
      });

      discountAmount = validation.discountAmount;
      total = validation.finalTotal;
      couponId = validation.couponId;
    }

    // Crear la orden en una transacción para mantener consistencia
    const createdOrder = await this.prisma.$transaction(async (prisma: any) => {
      const order = await prisma.order.create({
        data: {
          userId,
          status,
          subtotal,
          discountAmount,
          total,
          couponId: couponId || undefined,
          couponCode: couponCode || undefined,
          shippingName: address.fullName,
          shippingPhone: address.phone,
          shippingAddress:
            `${address.addressLine1} ${address.addressLine2 || ''}`.trim(),
          shippingCity: address.city,
          shippingState: address.state,
          shippingZip: address.zipCode,
          shippingCountry: address.country,
          shippingNotes: notes,
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });

      // Decrementar stock de los productos
      for (const it of orderItemsData) {
        await prisma.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return order;
    });

    // Registrar uso del cupón si se aplicó
    if (couponId) {
      await this.couponsService.applyCoupon(
        couponId,
        userId,
        createdOrder.id as string,
      );
    }

    // Enviar correo de confirmación del pedido
    try {
      // Obtener los items con información de productos para el email
      const orderWithProducts = await this.prisma.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      if (orderWithProducts) {
        // Preparar datos para el email
        const emailItems = orderWithProducts.items.map((item) => ({
          productName: item.product.name,
          variantName: item.variantName || undefined,
          quantity: item.quantity,
          price: item.price,
          imageUrl: item.product.image_url || undefined,
        }));

        await this.emailService.sendOrderConfirmationEmail({
          orderNumber: createdOrder.id,
          userName: user.name || 'Cliente',
          userEmail: user.email,
          items: emailItems,
          subtotal,
          shippingCost: 0, // TODO: Calcular costo de envío si aplica
          discount: discountAmount > 0 ? discountAmount : undefined,
          total,
          shippingAddress: {
            name: address.fullName,
            phone: address.phone,
            address:
              `${address.addressLine1} ${address.addressLine2 || ''}`.trim(),
            city: address.city,
            state: address.state,
            zip: address.zipCode || undefined,
          },
          orderDate: createdOrder.createdAt,
          estimatedDelivery: undefined, // TODO: Calcular fecha estimada
        });
      }
    } catch (error) {
      // Log error pero no fallar la creación de la orden
      console.error('Failed to send order confirmation email:', error);
    }

    // Enviar notificación al admin si está habilitada
    try {
      // Obtener configuración de la tienda
      const settings = await this.prisma.storeSettings.findUnique({
        where: { id: 'store-settings' },
      });

      // Si las notificaciones están habilitadas, enviar email al admin
      if (settings?.emailNotifications && settings?.supportEmail) {
        await this.emailService.sendNewOrderNotificationToAdmin({
          orderNumber: createdOrder.id,
          userName: user.name || 'Cliente',
          userEmail: user.email,
          total,
          itemCount: orderItemsData.length,
          adminEmail: settings.supportEmail,
        });
      }
    } catch (error) {
      // Log error pero no fallar la creación de la orden
      console.error('Failed to send admin notification email:', error);
    }

    return createdOrder as Order;
  }

  findAll(): Promise<Order[]> {
    return this.prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  findAllByUser(userId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const { status, notes } = updateOrderDto;

    // Filtrar y mapear datos válidos para Prisma
    const data: any = {};
    if (notes) data.shippingNotes = notes;
    // Nota: userId, items y addressId se ignoran en la actualización directa
    // para evitar inconsistencias. Si se requiere actualizar items,
    // se debería implementar una lógica específica.

    // Si no hay cambio de estado, actualización simple
    if (!status) {
      return this.prisma.order.update({
        where: { id },
        data,
      });
    }

    // Obtener orden actual con items para manejar stock
    const currentOrder = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!currentOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Si el estado no cambia, retornar
    if (currentOrder.status === status) {
      return this.prisma.order.update({
        where: { id },
        data: { ...data, status },
      });
    }

    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
      // Caso 1: Cancelar orden (Restaurar stock)
      if (status === 'CANCELLED' && currentOrder.status !== 'CANCELLED') {
        for (const item of currentOrder.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      // Caso 2: Reactivar orden cancelada (Descontar stock)
      if (status !== 'CANCELLED' && currentOrder.status === 'CANCELLED') {
        for (const item of currentOrder.items) {
          // Verificar stock antes de descontar
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || product.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for product ${product?.name || item.productId} to reactivate order`,
            );
          }

          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // Actualizar la orden
      return prisma.order.update({
        where: { id },
        data: { ...data, status },
      });
    });

    // Enviar notificación si el estado cambia a DELIVERED
    if (status === 'DELIVERED' && currentOrder.status !== 'DELIVERED') {
      await this.notificationsService.create(
        currentOrder.userId,
        '¡Tu pedido ha llegado!',
        `El pedido #${currentOrder.id.slice(-6)} ha sido entregado. Por favor, califica tus productos.`,
        'ORDER_DELIVERED',
        `/profile/orders/${currentOrder.id}`,
      );
    }

    return updatedOrder;
  }

  async remove(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.orderItem.deleteMany({
        where: { orderId: id },
      });

      return prisma.order.delete({
        where: { id },
      });
    });
  }
}
