import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const passwordChanged = !!updateUserDto.password;
    if (passwordChanged) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    // TODO: Revoke all refresh tokens if password was changed or role was downgraded
    // This should be handled by the controller calling AuthService.revokeRefreshTokens

    return updatedUser;
  }

  async remove(id: string) {
    // TODO: Revoke refresh tokens before deletion
    // This should be handled by the controller calling AuthService.revokeRefreshTokens

    // Delete all related records first to avoid foreign key constraint errors
    // Use a transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Delete notifications
      await tx.notification.deleteMany({ where: { userId: id } });

      // Delete product views (history)
      await tx.productView.deleteMany({ where: { userId: id } });

      // Delete questions
      await tx.question.deleteMany({ where: { userId: id } });

      // Delete reviews
      await tx.review.deleteMany({ where: { userId: id } });

      // Delete cart items first, then cart
      const cart = await tx.cart.findUnique({ where: { userId: id } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.delete({ where: { userId: id } });
      }

      // Delete wishlist items first, then wishlists
      const wishlists = await tx.wishlist.findMany({ where: { userId: id } });
      for (const wishlist of wishlists) {
        await tx.wishlistItem.deleteMany({
          where: { wishlistId: wishlist.id },
        });
      }
      await tx.wishlist.deleteMany({ where: { userId: id } });

      // Delete addresses
      await tx.address.deleteMany({ where: { userId: id } });

      // Delete order items first, then orders
      const orders = await tx.order.findMany({ where: { userId: id } });
      for (const order of orders) {
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      }
      await tx.order.deleteMany({ where: { userId: id } });

      // Finally delete the user
      return tx.user.delete({ where: { id } });
    });
  }

  async getHistory(userId: string) {
    return this.prisma.productView.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            image_url: true,
            slug: true,
            category: true,
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Check if user has a password (might be OAuth user)
    if (!user.password) {
      throw new BadRequestException(
        'No puedes cambiar la contraseña de una cuenta vinculada con Google',
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
