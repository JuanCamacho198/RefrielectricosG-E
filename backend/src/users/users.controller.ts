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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { AuditLogsService } from '../modules/audit-logs/audit-logs.service';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    role: string;
    id?: string;
    name?: string;
  };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getHistory(@Request() req: RequestWithUser) {
    return this.usersService.getHistory(req.user.userId);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.usersService.changePassword(
      req.user.userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    // Revoke all refresh tokens after password change for security
    await this.authService.revokeRefreshTokens(req.user.userId);

    return result;
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = req.user;

    // Solo ADMIN puede cambiar roles
    if (updateUserDto.role && user.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permisos para cambiar roles');
    }

    // Solo ADMIN o el propio usuario pueden editar
    if (user.userId !== id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('No puedes editar este usuario');
    }

    // Get old values for audit
    const oldUser = await this.usersService.findOne(id);

    const passwordChanged = !!updateUserDto.password;
    const updatedUser = await this.usersService.update(id, updateUserDto);

    // Log changes (especially role changes)
    const changes: Record<string, any> = {};
    if (updateUserDto.role && oldUser.role !== updateUserDto.role) {
      changes.role = { old: oldUser.role, new: updateUserDto.role };

      await this.auditLogsService.create({
        action: 'ROLE_CHANGE',
        entity: 'User',
        entityId: id,
        changes,
        oldValues: { role: oldUser.role, email: oldUser.email },
        newValues: { role: updateUserDto.role, email: oldUser.email },
        userId: user.id || user.userId,
        userName: user.name,
        userEmail: user.email,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : req.headers['user-agent'],
      });
    }

    // Revoke all refresh tokens if password was changed
    if (passwordChanged) {
      await this.authService.revokeRefreshTokens(id);
    }

    return updatedUser;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    const user = await this.usersService.findOne(id);

    // Log deletion
    await this.auditLogsService.create({
      action: 'DELETE',
      entity: 'User',
      entityId: id,
      oldValues: { name: user.name, email: user.email, role: user.role },
      userId: req.user.id || req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
    });

    // Revoke refresh tokens before deletion
    await this.authService.revokeRefreshTokens(id);
    return this.usersService.remove(id);
  }
}
