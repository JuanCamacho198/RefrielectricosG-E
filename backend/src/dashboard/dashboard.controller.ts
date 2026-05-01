import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.EMPLOYEE)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(
    @Query('period') period?: 'day' | 'week' | 'month' | 'quarter' | 'year',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: 'true' | 'false',
  ) {
    return this.dashboardService.getStats({
      period: period || 'month',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      compare: compare === 'true',
    });
  }

  @Get('notifications')
  getNotifications() {
    return this.dashboardService.getNotifications();
  }
}
