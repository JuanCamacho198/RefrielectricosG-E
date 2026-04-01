import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { AddressesModule } from './addresses/addresses.module';
import { FilesModule } from './files/files.module';
import { CartModule } from './cart/cart.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuestionsModule } from './questions/questions.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentsModule } from './payments/payments.module';
import { CouponsModule } from './coupons/coupons.module';
import { BannersModule } from './banners/banners.module';
import { SearchModule } from './search/search.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ExportsModule } from './modules/exports/exports.module';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '1000', 10),
        limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '10', 10),
      },
      {
        name: 'medium',
        ttl: parseInt(process.env.THROTTLE_MEDIUM_TTL ?? '10000', 10),
        limit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT ?? '50', 10),
      },
      {
        name: 'long',
        ttl: parseInt(process.env.THROTTLE_LONG_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LONG_LIMIT ?? '100', 10),
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    DashboardModule,
    WishlistsModule,
    AddressesModule,
    FilesModule,
    CartModule,
    ReviewsModule,
    NotificationsModule,
    QuestionsModule,
    SettingsModule,
    PaymentsModule,
    CouponsModule,
    BannersModule,
    SearchModule,
    AuditLogsModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
