import { Controller, Post, Body } from '@nestjs/common';
import { PublicAuthService } from './public-auth.service';

@Controller('public/auth')
export class PublicAuthController {
  constructor(private readonly publicAuthService: PublicAuthService) {}

  @Post('register')
  async register(@Body() body: any): Promise<any> {
    const res = await this.publicAuthService.register(body);
    await this.publicAuthService.generateOtp(res.userId);
    return res;
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { userId: string, otp: string }): Promise<any> {
    return this.publicAuthService.verifyOtp(body.userId, body.otp);
  }

  @Post('login')
  async login(@Body() body: any): Promise<any> {
    return this.publicAuthService.login(body);
  }
}
