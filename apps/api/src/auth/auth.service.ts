import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { BadRequestException } from '@nestjs/common';
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
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account is temporarily suspended. Please clear pending fee dues.');
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
    
    // 7 days expiration for the session in Redis to match JWT validity (assuming 7d in config, fallback to 7d)
    await this.redisService.whitelistSession(user.id, jti, 7 * 24 * 60 * 60);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        centreName,
      }
    };
  }


}
