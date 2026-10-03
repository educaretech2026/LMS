import { Module } from '@nestjs/common';
import { PublicAuthService } from './public-auth.service';
import { PublicAuthController } from './public-auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PublicAuthController],
  providers: [PublicAuthService],
  exports: [PublicAuthService]
})
export class PublicAuthModule {}
