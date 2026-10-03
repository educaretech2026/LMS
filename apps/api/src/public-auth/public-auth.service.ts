import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

@Injectable()
export class PublicAuthService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: any) {
    const { email, phone, name, password } = data;

    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required');
    }

    if (email) {
      const existing = await this.prisma.publicUser.findUnique({ where: { email } });
      if (existing) throw new BadRequestException('Email already in use');
    }

    if (phone) {
      const existing = await this.prisma.publicUser.findUnique({ where: { phone } });
      if (existing) throw new BadRequestException('Phone already in use');
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await argon2.hash(password);
    }

    const user = await this.prisma.publicUser.create({
      data: {
        email,
        phone,
        name,
        passwordHash,
      }
    });

    return {
      message: 'Registration successful. Please verify your OTP to activate your account.',
      userId: user.id
    };
  }

  async login(data: any) {
    const { email, phone, password } = data;

    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required');
    }

    let user = null;
    if (email) user = await this.prisma.publicUser.findUnique({ where: { email } });
    else if (phone) user = await this.prisma.publicUser.findUnique({ where: { phone } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified. Please verify your OTP.');
    }

    const payload = { sub: user.id, role: 'PUBLIC_LEARNER' };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar
      }
    };
  }

  async generateOtp(userId: string) {
    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpToken.create({
      data: {
        userId,
        otp,
        expiresAt
      }
    });

    // In a real scenario, this is where you'd dispatch the SMS or Email.
    // We mock it for now as per the plan.
    console.log(`[MOCK SMS] OTP for user ${userId} is: ${otp}`);

    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyOtp(userId: string, otp: string) {
    const otpRecord = await this.prisma.otpToken.findFirst({
      where: {
        userId,
        otp,
        used: false,
        expiresAt: { gt: new Date() }
      },
      // Note: order by created at descending is missing because Prisma doesn't auto add it unless specified, but schema has it?
      // Wait, let me just grab the first valid one.
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.otpToken.update({
      where: { id: otpRecord.id },
      data: { used: true }
    });

    // Mark user as verified
    await this.prisma.publicUser.update({
      where: { id: userId },
      data: { isVerified: true }
    });

    return { success: true, message: 'Account verified successfully' };
  }
}
