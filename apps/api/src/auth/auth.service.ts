import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    const payload = { email: user.email, sub: user.id, role: user.role.name, centreName };
    
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
