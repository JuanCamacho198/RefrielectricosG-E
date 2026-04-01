import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    role: string;
    id?: string;
    name?: string;
  };
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Throttle({ short: { limit: 5, ttl: 1000 } }) // 5 órdenes por segundo
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('mine')
  findAllMyOrders(@Request() req: RequestWithUser) {
    return this.ordersService.findAllByUser(req.user.userId);
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  findAllByUser(@Param('userId') userId: string) {
    return this.ordersService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Request() req: RequestWithUser,
  ) {
    // Get old order for audit
    const oldOrder = await this.ordersService.findOne(id);

    const updatedOrder = await this.ordersService.update(id, updateOrderDto);

    // Log status changes
    if (updateOrderDto.status && oldOrder.status !== updateOrderDto.status) {
      await this.auditLogsService.create({
        action: 'STATUS_CHANGE',
        entity: 'Order',
        entityId: id,
        changes: {
          status: { old: oldOrder.status, new: updateOrderDto.status },
        },
        oldValues: { status: oldOrder.status, total: oldOrder.total },
        newValues: { status: updateOrderDto.status, total: oldOrder.total },
        userId: req.user.id || req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : req.headers['user-agent'],
      });
    }

    return updatedOrder;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    const order = await this.ordersService.findOne(id);

    // Log deletion
    await this.auditLogsService.create({
      action: 'DELETE',
      entity: 'Order',
      entityId: id,
      oldValues: {
        status: order.status,
        total: order.total,
        userId: order.userId,
      },
      userId: req.user.id || req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
    });

    return this.ordersService.remove(id);
  }
}
