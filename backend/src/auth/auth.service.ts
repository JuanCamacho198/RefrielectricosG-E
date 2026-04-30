import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../modules/email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    } else {
      this.logger.warn(
        'GOOGLE_CLIENT_ID not configured. Google OAuth will be disabled.',
      );
    }
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findByEmail(email);

    // Check if user exists and uses LOCAL provider
    if (!user) {
      return null;
    }

    // If user registered with Google, they can't login with password
    if (user.provider === 'GOOGLE') {
      throw new BadRequestException(
        'Esta cuenta usa Google Sign-In. Por favor inicia sesión con Google.',
      );
    }

    // Validate password
    if (user.password && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }

    return null;
  }

  async login(user: Omit<User, 'password'>) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    // Admin users get longer sessions (24 hours) vs regular users (1 hour)
    const expiresIn = user.role === 'ADMIN' ? '24h' : '1h';

    // Generate access token
    const accessToken = this.jwtService.sign(payload as object, { expiresIn });

    // Generate refresh token
    const refreshTokenPayload = { sub: user.id };
    const refreshToken = this.jwtService.sign(refreshTokenPayload as object, {
      expiresIn: '7d', // Refresh token lasts 7 days
    });

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        user.name || 'Usuario',
        verifyToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        error,
      );
      // Don't fail registration if email fails
    }

    return user;
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      this.jwtService.verify(refreshToken);

      // Check if refresh token exists in database and is not expired
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = storedToken.user;

      // ROTATION: Delete the old refresh token (invalidate it)
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Generate new access token
      const accessPayload = {
        email: user.email,
        sub: user.id,
        role: user.role,
      };
      const expiresIn = user.role === 'ADMIN' ? '24h' : '1h';
      const newAccessToken = this.jwtService.sign(accessPayload as object, {
        expiresIn,
      });

      // ROTATION: Generate new refresh token
      const newRefreshTokenPayload = { sub: user.id };
      const newRefreshToken = this.jwtService.sign(
        newRefreshTokenPayload as object,
        {
          expiresIn: '7d',
        },
      );

      // Store new refresh token in database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await this.prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken, // Return new refresh token
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  /**
   * Google OAuth login
   * Verifies Google token and creates/logs in user
   */
  async googleLogin(credential: string) {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const { sub: googleId, email, name, picture } = payload;

      if (!email) {
        throw new BadRequestException('Email not provided by Google');
      }

      // Check if user exists by Google ID
      let user = await this.usersService.findByGoogleId(googleId);

      if (!user) {
        // Check if user exists by email (auto-link accounts)
        user = await this.usersService.findByEmail(email);

        if (user) {
          // Link Google account to existing user
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              googleId,
              provider: 'GOOGLE',
              avatar: picture || user.avatar,
              emailVerified: true, // Google emails are verified
            },
          });
          this.logger.log(
            `Linked Google account to existing user: ${user.email}`,
          );
        } else {
          // Create new user with Google
          user = await this.prisma.user.create({
            data: {
              email,
              name: name || email.split('@')[0],
              googleId,
              provider: 'GOOGLE',
              avatar: picture,
              emailVerified: true, // Google emails are verified
              password: null, // No password for Google users
            },
          });
          this.logger.log(`Created new user via Google: ${user.email}`);

          // Send welcome email for new Google users
          try {
            await this.emailService.sendWelcomeEmail(
              user.email,
              user.name || 'Usuario',
            );
          } catch (error) {
            this.logger.error(
              `Failed to send welcome email to ${user.email}`,
              error,
            );
            // Don't fail login if welcome email fails
          }
        }
      }

      // Generate JWT tokens
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return this.login(userWithoutPassword);
    } catch (error) {
      this.logger.error('Google login failed', error);
      throw new UnauthorizedException('Invalid Google credentials');
    }
  }

  /**
   * Initiate password reset process
   * Generates reset token and sends email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists for security
      return {
        message:
          'Si el correo existe, recibirás un enlace para restablecer tu contraseña',
      };
    }

    if (user.provider === 'GOOGLE') {
      throw new BadRequestException(
        'Esta cuenta usa Google Sign-In. No necesitas restablecer contraseña.',
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name || 'Usuario',
        resetToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        error,
      );
      throw new BadRequestException('Error al enviar el correo');
    }

    return {
      message:
        'Si el correo existe, recibirás un enlace para restablecer tu contraseña',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Revoke all refresh tokens for security
    await this.revokeRefreshTokens(user.id);

    this.logger.log(`Password reset successful for user: ${user.email}`);

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    this.logger.log(`Email verified for user: ${user.email}`);

    // Send welcome email after successful verification
    try {
      await this.emailService.sendWelcomeEmail(
        user.email,
        user.name || 'Usuario',
      );
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${user.email}`, error);
      // Don't fail verification if welcome email fails
    }

    return { message: 'Correo verificado correctamente' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists for security
      return {
        message: 'Si el correo existe, recibirás un enlace de verificación',
      };
    }

    if (user.emailVerified) {
      throw new BadRequestException('El correo ya está verificado');
    }

    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        user.name || 'Usuario',
        verifyToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${user.email}`,
        error,
      );
      throw new BadRequestException('Error al enviar el correo');
    }

    return {
      message: 'Si el correo existe, recibirás un enlace de verificación',
    };
  }

  /**
   * Limpia tokens expirados de la base de datos
   * Puede ser llamado periódicamente por un cron job
   */
  async cleanupExpiredTokens() {
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return {
      deleted: deleted.count,
      message: `${deleted.count} expired tokens removed`,
    };
  }

  /**
   * Revoca todos los tokens de un usuario excepto el actual
   * Útil para "Cerrar sesión en otros dispositivos"
   */
  async revokeOtherTokens(userId: string, currentToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        token: {
          not: currentToken,
        },
      },
    });
  }

  /**
   * Check authentication provider for an email
   * Returns the provider (LOCAL or GOOGLE) if user exists, or null if not found
   */
  async checkAuthProvider(email: string): Promise<{
    exists: boolean;
    provider?: 'LOCAL' | 'GOOGLE';
    message: string;
  }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        exists: false,
        message: 'Usuario no encontrado',
      };
    }

    return {
      exists: true,
      provider: user.provider,
      message:
        user.provider === 'GOOGLE'
          ? 'Esta cuenta usa Google Sign-In'
          : 'Esta cuenta usa email y contraseña',
    };
  }
}
