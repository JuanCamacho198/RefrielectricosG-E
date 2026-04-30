import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExportOrdersDto,
  ExportProductsDto,
  ExportUsersDto,
  ExportFormat,
} from './dto/export.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportOrders(filters: ExportOrdersDto): Promise<Buffer> {
    const where: Prisma.OrderWhereInput = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (filters.format === ExportFormat.CSV) {
      return this.generateOrdersCSV(orders);
    }

    return this.generateOrdersExcel(orders);
  }

  async exportProducts(filters: ExportProductsDto): Promise<Buffer> {
    const where: Prisma.ProductWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.brand) {
      where.brand = filters.brand;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (filters.format === ExportFormat.CSV) {
      return this.generateProductsCSV(products);
    }

    return this.generateProductsExcel(products);
  }

  async exportUsers(filters: ExportUsersDto): Promise<Buffer> {
    const where: Prisma.UserWhereInput = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    if (filters.role) {
      where.role = filters.role as any;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (filters.format === ExportFormat.CSV) {
      return this.generateUsersCSV(users);
    }

    return this.generateUsersExcel(users);
  }

  // Excel Generators
  private async generateOrdersExcel(orders: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Refrielectricos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Pedidos');

    // Define columns
    sheet.columns = [
      { header: 'ID Pedido', key: 'id', width: 15 },
      { header: 'Fecha', key: 'date', width: 12 },
      { header: 'Cliente', key: 'customer', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Estado Pago', key: 'paymentStatus', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'Descuento', key: 'discount', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Productos', key: 'items', width: 40 },
      { header: 'Dirección', key: 'address', width: 40 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Add data
    orders.forEach((order) => {
      const itemsList = order.items
        .map((item: any) => `${item.quantity}x ${item.product?.name || 'N/A'}`)
        .join(', ');

      sheet.addRow({
        id: order.id.slice(-8).toUpperCase(),
        date: new Date(order.createdAt).toLocaleDateString('es-CO'),
        customer: order.user?.name || 'N/A',
        email: order.user?.email || 'N/A',
        status: this.translateOrderStatus(order.status),
        paymentStatus: order.paymentStatus || 'N/A',
        subtotal: order.subtotal,
        discount: order.discountAmount || 0,
        total: order.total,
        items: itemsList,
        address: `${order.shippingCity}, ${order.shippingDepartment}`,
      });
    });

    // Format currency columns
    ['subtotal', 'discount', 'total'].forEach((col) => {
      sheet.getColumn(col).numFmt = '"$"#,##0';
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async generateProductsExcel(products: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Refrielectricos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Productos');

    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Nombre', key: 'name', width: 40 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Subcategoría', key: 'subcategory', width: 20 },
      { header: 'Marca', key: 'brand', width: 15 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'Precio Promo', key: 'promoPrice', width: 12 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Activo', key: 'isActive', width: 10 },
      { header: 'Creado', key: 'createdAt', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '70AD47' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    products.forEach((product) => {
      sheet.addRow({
        sku: product.sku || 'N/A',
        name: product.name,
        category: product.category || 'N/A',
        subcategory: product.subcategory || 'N/A',
        brand: product.brand || 'N/A',
        price: product.price,
        promoPrice: product.promoPrice || '',
        stock: product.stock,
        isActive: product.isActive ? 'Sí' : 'No',
        createdAt: new Date(product.createdAt).toLocaleDateString('es-CO'),
      });
    });

    ['price', 'promoPrice'].forEach((col) => {
      sheet.getColumn(col).numFmt = '"$"#,##0';
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async generateUsersExcel(users: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Refrielectricos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Usuarios');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Rol', key: 'role', width: 12 },
      { header: 'Proveedor', key: 'provider', width: 12 },
      { header: 'Email Verificado', key: 'emailVerified', width: 15 },
      { header: 'Total Pedidos', key: 'ordersCount', width: 12 },
      { header: 'Fecha Registro', key: 'createdAt', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'ED7D31' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    users.forEach((user) => {
      sheet.addRow({
        id: user.id.slice(-8).toUpperCase(),
        name: user.name || 'N/A',
        email: user.email,
        role: user.role === 'ADMIN' ? 'Administrador' : 'Usuario',
        provider: user.provider === 'GOOGLE' ? 'Google' : 'Email',
        emailVerified: user.emailVerified ? 'Sí' : 'No',
        ordersCount: user._count?.orders || 0,
        createdAt: new Date(user.createdAt).toLocaleDateString('es-CO'),
      });
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // CSV Generators
  private generateOrdersCSV(orders: any[]): Buffer {
    const headers = [
      'ID Pedido',
      'Fecha',
      'Cliente',
      'Email',
      'Estado',
      'Estado Pago',
      'Subtotal',
      'Descuento',
      'Total',
      'Productos',
      'Ciudad',
      'Departamento',
    ];

    const rows = orders.map((order) => {
      const itemsList = order.items
        .map((item: any) => `${item.quantity}x ${item.product?.name || 'N/A'}`)
        .join('; ');

      return [
        order.id.slice(-8).toUpperCase(),
        new Date(order.createdAt).toLocaleDateString('es-CO'),
        order.user?.name || 'N/A',
        order.user?.email || 'N/A',
        this.translateOrderStatus(order.status),
        order.paymentStatus || 'N/A',
        order.subtotal,
        order.discountAmount || 0,
        order.total,
        `"${itemsList}"`,
        order.shippingCity || 'N/A',
        order.shippingDepartment || 'N/A',
      ];
    });

    return this.arrayToCSV(headers, rows);
  }

  private generateProductsCSV(products: any[]): Buffer {
    const headers = [
      'SKU',
      'Nombre',
      'Categoría',
      'Subcategoría',
      'Marca',
      'Precio',
      'Precio Promo',
      'Stock',
      'Activo',
      'Fecha Creación',
    ];

    const rows = products.map((product) => [
      product.sku || 'N/A',
      `"${product.name}"`,
      product.category || 'N/A',
      product.subcategory || 'N/A',
      product.brand || 'N/A',
      product.price,
      product.promoPrice || '',
      product.stock,
      product.isActive ? 'Sí' : 'No',
      new Date(product.createdAt).toLocaleDateString('es-CO'),
    ]);

    return this.arrayToCSV(headers, rows);
  }

  private generateUsersCSV(users: any[]): Buffer {
    const headers = [
      'ID',
      'Nombre',
      'Email',
      'Rol',
      'Proveedor',
      'Email Verificado',
      'Total Pedidos',
      'Fecha Registro',
    ];

    const rows = users.map((user) => [
      user.id.slice(-8).toUpperCase(),
      user.name || 'N/A',
      user.email,
      user.role === 'ADMIN' ? 'Administrador' : 'Usuario',
      user.provider === 'GOOGLE' ? 'Google' : 'Email',
      user.emailVerified ? 'Sí' : 'No',
      user._count?.orders || 0,
      new Date(user.createdAt).toLocaleDateString('es-CO'),
    ]);

    return this.arrayToCSV(headers, rows);
  }

  private arrayToCSV(headers: string[], rows: any[][]): Buffer {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const csvContent =
      BOM + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  private translateOrderStatus(status: string): string {
    const translations: Record<string, string> = {
      PENDING: 'Pendiente',
      PAID: 'Pagado',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    };
    return translations[status] || status;
  }
}
