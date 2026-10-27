import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { getJwtSecret } from '../common/config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService, private redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const isProduction = process.env.NODE_ENV === 'production';
          if (request?.cookies) {
            const hostCookie = request.cookies['__Host-AccessToken'];
            if (hostCookie) return hostCookie;
            if (!isProduction) {
              return request.cookies['AccessToken'] || null;
            }
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    const isValid = await this.redisService.isSessionValid(payload.sub, payload.jti);
    if (!isValid) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }
    
    // Track user as online
    await this.redisService.trackOnlineUser(payload.sub);

    if (payload.role === 'PUBLIC_LEARNER') {
      const publicUser = await this.prisma.publicUser.findUnique({
        where: { id: payload.sub }
      });
      if (!publicUser) throw new UnauthorizedException('User not found');
      // Mock the role so RolesGuard works properly and attach jti for session revocation
      return { ...publicUser, role: { name: 'PUBLIC_LEARNER' }, status: 'ACTIVE', jti: payload.jti };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        userCentres: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or not found');
    }

    const customModules = await this.redisService.getUserModulePermissions(payload.sub);
    let permissions = user.role?.permissions?.map((p: any) => p.permission?.action || p.action).filter(Boolean) || [];
    if (customModules !== null) {
      permissions = permissions.filter((act: string) => {
        const modKey = act.split('.')[0].toUpperCase();
        return customModules.map(m => m.toUpperCase()).includes(modKey);
      });
    }

    const { password: _pwd, ...safeUser } = user;
    return { ...safeUser, permissions, customModules, jti: payload.jti };
  }
}
