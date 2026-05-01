import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExportsService } from './exports.service';
import {
  ExportOrdersDto,
  ExportProductsDto,
  ExportUsersDto,
  ExportFormat,
} from './dto/export.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Exports')
@Controller('exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('orders')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportOrders(@Query() filters: ExportOrdersDto, @Res() res: Response) {
    const buffer = await this.exportsService.exportOrders(filters);
    const isExcel = filters.format !== ExportFormat.CSV;
    const filename = `pedidos_${new Date().toISOString().split('T')[0]}`;

    res.setHeader(
      'Content-Type',
      isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.${isExcel ? 'xlsx' : 'csv'}"`,
    );
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('products')
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'brand', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportProducts(
    @Query() filters: ExportProductsDto,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportProducts(filters);
    const isExcel = filters.format !== ExportFormat.CSV;
    const filename = `productos_${new Date().toISOString().split('T')[0]}`;

    res.setHeader(
      'Content-Type',
      isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.${isExcel ? 'xlsx' : 'csv'}"`,
    );
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('users')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportUsers(@Query() filters: ExportUsersDto, @Res() res: Response) {
    const buffer = await this.exportsService.exportUsers(filters);
    const isExcel = filters.format !== ExportFormat.CSV;
    const filename = `usuarios_${new Date().toISOString().split('T')[0]}`;

    res.setHeader(
      'Content-Type',
      isExcel
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.${isExcel ? 'xlsx' : 'csv'}"`,
    );
    res.status(HttpStatus.OK).send(buffer);
  }
}
