import { Controller, Post, Body, Res, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RedisService } from '../redis/redis.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly redisService: RedisService
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and set HttpOnly cookie' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.authService.login(loginDto);
    
    res.cookie('AccessToken', access_token, {
      httpOnly: true,
      secure: true, // MUST be true for SameSite=None
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

    return { message: 'Login successful', user, access_token };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and clear cookie' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    // Revoke the session in Redis
    if (req.user?.id && req.user?.jti) {
      await this.redisService.revokeSession(req.user.id, req.user.jti);
    }
    
    res.cookie('AccessToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires: new Date(0),
    });
    return { message: 'Logout successful' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out of all devices' })
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    if (req.user?.id) {
      await this.redisService.revokeAllSessions(req.user.id);
    }
    
    res.cookie('AccessToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires: new Date(0),
    });
    return { message: 'Logged out of all devices successfully' };
  }


}
