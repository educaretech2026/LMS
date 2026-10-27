import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email ? loginDto.email.toLowerCase().trim() : '';

    // 1. SEC-08: Check if email is temporarily locked due to excessive failed attempts
    const isLocked = await this.redisService.isLoginLocked(normalizedEmail);
    if (isLocked) {
      throw new HttpException(
        'Too many failed login attempts. Please try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      await this.redisService.incrementLoginAttempts(normalizedEmail);
      // Uniform error message to prevent user enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedException('Your account is suspended. Please contact an administrator.');
      }
      throw new UnauthorizedException('Your account is inactive.');
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
      const attempts = await this.redisService.incrementLoginAttempts(normalizedEmail);
      if (attempts >= 5) {
        throw new HttpException(
          'Too many failed login attempts. Please try again in 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      // Uniform error message to prevent account enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.redisService.resetLoginAttempts(normalizedEmail);

    let centreName = 'Educare HQ';
    if (user.role.name === 'STUDENT') {
      const sp = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: { include: { centre: true } } } } }
      });
      if (sp?.enrollments?.[0]?.batch?.centre?.name) {
        centreName = sp.enrollments[0].batch.centre.name;
      }
    } else {
      const uc = await this.prisma.userCentre.findFirst({
        where: { userId: user.id },
        include: { centre: true }
      });
      if (uc?.centre?.name) {
        centreName = uc.centre.name;
      }
    }

    const jti = uuidv4();
    const payload = { email: user.email, sub: user.id, role: user.role.name, centreName, jti };
    
    // SEC-04: Mandatory session registration check
    const sessionRegistered = await this.redisService.whitelistSession(user.id, jti, 7 * 24 * 60 * 60);
    if (!sessionRegistered) {
      throw new HttpException(
        'Authentication session service unavailable. Please retry shortly.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    const mustChangePassword = await this.redisService.isMustChangePassword(user.id);
    let permissions = user.role?.permissions?.map((p: any) => p.permission?.action).filter(Boolean) || [];
    const customModules = await this.redisService.getUserModulePermissions(user.id);
    if (customModules !== null) {
      permissions = permissions.filter((act: string) => {
        const modKey = act.split('.')[0].toUpperCase();
        return customModules.map(m => m.toUpperCase()).includes(modKey);
      });
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        centreName,
        permissions,
        mustChangePassword,
      }
    };
  }

  async changePassword(userId: string, data: { currentPassword?: string; newPassword?: string }) {
    if (!data.newPassword || data.newPassword.length < 8) {
      throw new HttpException('New password must be at least 8 characters long', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (data.currentPassword) {
      const isValid = await argon2.verify(user.password, data.currentPassword);
      if (!isValid) {
        throw new UnauthorizedException('Current password does not match');
      }
    }

    const isSameAsCurrent = await argon2.verify(user.password, data.newPassword);
    if (isSameAsCurrent) {
      throw new HttpException('New password cannot be the same as your existing password', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = await argon2.hash(data.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.redisService.clearMustChangePassword(userId);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}

