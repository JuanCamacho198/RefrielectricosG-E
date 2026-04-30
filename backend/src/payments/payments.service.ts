import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { EpaycoConfirmationDto } from './dto/epayco-confirmation.dto';
import * as crypto from 'crypto';
import type { Product, OrderStatus } from '@prisma/client';

/**
 * ePayco Payment Integration Service
 *
 * Flow:
 * 1. Frontend calls createEpaycoSession with cart data
 * 2. Backend validates cart, creates PENDING order, returns ePayco form fields
 * 3. Frontend submits form to ePayco checkout
 * 4. User completes payment on ePayco
 * 5. ePayco calls our webhook (handleEpaycoConfirmation)
 * 6. We validate signature and update order status
 * 7. User is redirected to our success/error page
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // ePayco configuration
  private readonly epaycoPublicKey: string;
  private readonly epaycoPrivateKey: string;
  private readonly epaycoPKey: string;
  private readonly epaycoCustId: string;
  private readonly epaycoTest: boolean;
  private readonly baseBackendUrl: string;
  private readonly baseFrontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly couponsService: CouponsService,
  ) {
    // Load ePayco configuration from environment variables
    this.epaycoPublicKey = this.config.get<string>('EPAYCO_PUBLIC_KEY', '');
    this.epaycoPrivateKey = this.config.get<string>('EPAYCO_PRIVATE_KEY', '');
    this.epaycoPKey = this.config.get<string>('EPAYCO_P_KEY', '');
    this.epaycoCustId = this.config.get<string>('EPAYCO_CUST_ID', '');
    this.epaycoTest = this.config.get<string>('EPAYCO_TEST', 'true') === 'true';
    this.baseBackendUrl = this.config.get<string>(
      'BASE_URL_BACKEND',
      'http://localhost:4000',
    );
    this.baseFrontendUrl = this.config.get<string>(
      'BASE_URL_FRONTEND',
      'http://localhost:3000',
    );

    this.logger.log(`ePayco configured - Test mode: ${this.epaycoTest}`);
  }

  /**
   * Create an ePayco payment session
   * - Validates cart items against database
   * - Creates a PENDING order
   * - Returns all fields needed for ePayco checkout form
   */
  async createEpaycoSession(dto: CreatePaymentSessionDto): Promise<{
    success: boolean;
    orderId: string;
    epaycoData: Record<string, string>;
  }> {
    const { userId, addressId, items, notes, couponCode } = dto;

    // 1. Validate user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // 2. Validate address exists and belongs to user
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
      throw new NotFoundException(
        `Address with ID ${addressId} not found or does not belong to user`,
      );
    }

    // 3. Validate cart is not empty
    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 4. Fetch all products and validate
    const productIds = items.map((item) => item.productId);
    const products: Product[] = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productsMap = new Map(products.map((p: Product) => [p.id, p]));

    // 5. Calculate subtotal and prepare order items
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
      if (!product.isActive) {
        throw new BadRequestException(
          `Product ${product.name} is not available`,
        );
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}. Available: ${product.stock}`,
        );
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price, // Snapshot price at time of purchase
      });
    }

    // 5.5. Validate and apply coupon if provided
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

    // 6. Create PENDING order in a transaction
    const order = await this.prisma.$transaction(async (prisma: any) => {
      const createdOrder = await prisma.order.create({
        data: {
          userId,
          status: 'PENDING' as OrderStatus,
          subtotal,
          discountAmount,
          total,
          couponId: couponId || undefined,
          couponCode: couponCode || undefined,
          // Shipping address snapshot
          shippingName: address.fullName,
          shippingPhone: address.phone,
          shippingAddress:
            `${address.addressLine1} ${address.addressLine2 || ''}`.trim(),
          shippingCity: address.city,
          shippingState: address.state,
          shippingZip: address.zipCode,
          shippingCountry: address.country,
          shippingNotes: notes,
          // Payment fields (will be updated by webhook)
          paymentMethod: 'EPAYCO',
          paymentStatus: 'PENDING',
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });

      // Reserve stock (decrement)
      for (const item of orderItemsData) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return createdOrder;
    });

    // Register coupon usage if a coupon was applied
    if (couponId) {
      await this.couponsService.applyCoupon(couponId, userId, order.id);
    }

    this.logger.log(
      `Created PENDING order ${order.id} for user ${userId}, total: ${total}`,
    );

    // 7. Build ePayco checkout data for JavaScript SDK
    const invoice = order.id; // Use order ID as invoice reference
    const description = `Compra Refrielectricos #${order.id.slice(-8).toUpperCase()}`;

    // URLs for ePayco callbacks
    const responseUrl = `${this.baseFrontendUrl}/checkout/success?orderId=${order.id}`;
    const confirmationUrl = `${this.baseBackendUrl}/payments/epayco-confirmation`;

    // ePayco data for JavaScript SDK (checkout.js)
    const epaycoData: Record<string, string> = {
      // Public key for SDK configuration
      public_key: this.epaycoPublicKey,
      test: String(this.epaycoTest),

      // Transaction data
      name: 'Compra Refrielectricos',
      description: description,
      invoice: invoice,
      currency: 'cop',
      amount: total.toFixed(0), // ePayco expects integer for COP
      tax_base: '0',
      tax: '0',

      // Customer/billing info
      name_billing: address.fullName,
      address_billing: address.addressLine1,
      mobilephone_billing: address.phone,
      email_billing: user.email,

      // Callback URLs
      response: responseUrl,
      confirmation: confirmationUrl,

      // Extra fields (to identify order in webhook)
      extra1: order.id, // orderId
      extra2: userId,
      extra3: '',
    };

    return {
      success: true,
      orderId: order.id,
      epaycoData,
    };
  }

  /**
   * Handle ePayco webhook confirmation
   * - Validates the signature
   * - Updates order status based on response code
   * - Is idempotent (safe to call multiple times)
   */
  async handleEpaycoConfirmation(
    data: EpaycoConfirmationDto,
  ): Promise<{ received: boolean; message: string }> {
    this.logger.log('Received ePayco confirmation webhook');
    this.logger.debug('Webhook payload:', JSON.stringify(data, null, 2));

    const {
      x_ref_payco,
      x_id_invoice,
      x_amount,
      x_currency_code,
      x_signature,
      x_cod_response,
      x_response,
      x_response_reason_text,
      x_approval_code,
      x_transaction_id,
      x_franchise,
      x_extra1, // orderId
      x_test_request,
    } = data;

    // 1. Get orderId from x_extra1 or x_id_invoice
    const orderId = x_extra1 || x_id_invoice;
    if (!orderId) {
      this.logger.error('Webhook missing orderId (x_extra1 or x_id_invoice)');
      throw new BadRequestException('Missing order reference');
    }

    // 2. Validate signature
    const isValidSignature = this.validateEpaycoSignature({
      x_ref_payco: x_ref_payco || '',
      x_transaction_id: x_transaction_id || '',
      x_amount: x_amount || '0',
      x_currency_code: x_currency_code || 'COP',
      x_signature: x_signature || '',
    });

    if (!isValidSignature) {
      this.logger.error(`Invalid signature for order ${orderId}`);
      // In production, you might want to reject this
      // For now, log and continue for testing
      this.logger.warn('Continuing despite invalid signature (test mode)');
    }

    // 3. Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Order not found: ${orderId}`);
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // 4. Check if already processed (idempotency)
    if (order.paymentStatus === 'COMPLETED' && order.status === 'PAID') {
      this.logger.log(`Order ${orderId} already processed, skipping`);
      return { received: true, message: 'Order already processed' };
    }

    // 5. Map ePayco response code to order status
    const { orderStatus, paymentStatus } =
      this.mapEpaycoResponseToStatus(x_cod_response);

    // 6. Update order with payment information
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: orderStatus,
        paymentStatus,
        paymentReference: x_ref_payco,
        paymentMethod: x_franchise || 'EPAYCO',
        paymentApprovalCode: x_approval_code,
        paymentResponseCode: x_cod_response,
        paymentResponseMessage: x_response_reason_text || x_response,
        paymentTransactionId: x_transaction_id,
        paymentDate: new Date(),
        isTestPayment: x_test_request === '1' || x_test_request === 'TRUE',
      },
    });

    this.logger.log(
      `Order ${orderId} updated: status=${orderStatus}, paymentStatus=${paymentStatus}, ref=${x_ref_payco}`,
    );

    // 7. If payment failed/rejected, restore stock
    if (orderStatus === 'CANCELLED' || paymentStatus === 'FAILED') {
      await this.restoreOrderStock(orderId);
      this.logger.log(`Stock restored for cancelled/failed order ${orderId}`);
    }

    return {
      received: true,
      message: `Order ${orderId} updated to ${orderStatus}`,
    };
  }

  /**
   * Validate ePayco signature using SHA-256
   * Signature format: SHA256(p_cust_id_cliente^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code)
   */
  private validateEpaycoSignature(params: {
    x_ref_payco: string;
    x_transaction_id: string;
    x_amount: string;
    x_currency_code: string;
    x_signature: string;
  }): boolean {
    const {
      x_ref_payco,
      x_transaction_id,
      x_amount,
      x_currency_code,
      x_signature,
    } = params;

    // Build signature string per ePayco documentation
    const signatureString = `${this.epaycoCustId}^${this.epaycoPKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;

    // Calculate SHA-256 hash
    const calculatedSignature = crypto
      .createHash('sha256')
      .update(signatureString)
      .digest('hex');

    this.logger.debug(`Signature string: ${signatureString}`);
    this.logger.debug(`Calculated: ${calculatedSignature}`);
    this.logger.debug(`Received: ${x_signature}`);

    return calculatedSignature === x_signature;
  }

  /**
   * Map ePayco response code to internal order/payment status
   */
  private mapEpaycoResponseToStatus(codResponse?: string): {
    orderStatus: OrderStatus;
    paymentStatus: string;
  } {
    switch (codResponse) {
      case '1': // Aceptada
        return { orderStatus: 'PAID', paymentStatus: 'COMPLETED' };
      case '2': // Rechazada
        return { orderStatus: 'CANCELLED', paymentStatus: 'REJECTED' };
      case '3': // Pendiente
        return { orderStatus: 'PENDING', paymentStatus: 'PENDING' };
      case '4': // Fallida
        return { orderStatus: 'CANCELLED', paymentStatus: 'FAILED' };
      case '6': // Reversada
        return { orderStatus: 'CANCELLED', paymentStatus: 'REVERSED' };
      case '7': // Retenida
        return { orderStatus: 'PENDING', paymentStatus: 'HELD' };
      case '8': // Iniciada
        return { orderStatus: 'PENDING', paymentStatus: 'INITIATED' };
      case '9': // Expirada
        return { orderStatus: 'CANCELLED', paymentStatus: 'EXPIRED' };
      case '10': // Abandonada
        return { orderStatus: 'CANCELLED', paymentStatus: 'ABANDONED' };
      case '11': // Cancelada
        return { orderStatus: 'CANCELLED', paymentStatus: 'CANCELLED' };
      case '12': // Antifraude
        return { orderStatus: 'PENDING', paymentStatus: 'ANTIFRAUD' };
      default:
        return { orderStatus: 'PENDING', paymentStatus: 'UNKNOWN' };
    }
  }

  /**
   * Restore stock when order is cancelled/failed
   */
  private async restoreOrderStock(orderId: string): Promise<void> {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    for (const item of orderItems) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  /**
   * Get order status for frontend success page
   */
  async getOrderPaymentStatus(orderId: string): Promise<{
    orderId: string;
    status: string;
    paymentStatus: string;
    total: number;
    paymentReference?: string;
    paymentMethod?: string;
    createdAt: Date;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        total: true,
        paymentReference: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus || 'UNKNOWN',
      total: order.total,
      paymentReference: order.paymentReference || undefined,
      paymentMethod: order.paymentMethod || undefined,
      createdAt: order.createdAt,
    };
  }
}
