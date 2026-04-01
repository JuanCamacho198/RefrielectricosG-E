import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';

export interface CreateAuditLogDto {
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async log(
    action: string,
    entity: string,
    entityId: string,
    changes: Record<string, any>,
    req: Request,
  ) {
    const user = req.user;
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    Object.keys(changes).forEach((key) => {
      oldValues[key] = changes[key].old;
      newValues[key] = changes[key].new;
    });

    return this.create({
      action,
      entity,
      entityId,
      changes,
      oldValues,
      newValues,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    entity?: string;
    userId?: string;
    action?: string;
  }) {
    const { skip = 0, take = 50, entity, userId, action } = params;

    const where: any = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page: Math.floor(skip / take) + 1,
      totalPages: Math.ceil(total / take),
    };
  }

  async findByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
