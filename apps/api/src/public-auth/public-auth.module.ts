import { Module } from '@nestjs/common';
import { PublicAuthService } from './public-auth.service';
import { PublicAuthController } from './public-auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { getJwtSecret } from '../common/config/jwt.config';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [PublicAuthController],
  providers: [PublicAuthService],
  exports: [PublicAuthService]
})
export class PublicAuthModule {}
