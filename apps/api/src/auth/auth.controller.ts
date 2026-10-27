import { Controller, Post, Body, Res, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RedisService } from '../redis/redis.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly redisService: RedisService
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and set HttpOnly cookie' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.authService.login(loginDto);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction ? '__Host-AccessToken' : 'AccessToken';
    res.cookie(cookieName, access_token, {
      httpOnly: true,
      secure: true, // MUST be true for SameSite=None and __Host- cookies
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days matching JWT expiration
    });

    return { message: 'Login successful', user, access_token };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and clear cookie' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    let sessionRevoked = true;
    if (req.user?.id && req.user?.jti) {
      sessionRevoked = await this.redisService.revokeSession(req.user.id, req.user.jti);
    }
    
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('__Host-AccessToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires: new Date(0),
    });
    if (!isProduction) {
      res.cookie('AccessToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        expires: new Date(0),
      });
    }
    return {
      message: sessionRevoked
        ? 'Logout successful'
        : 'Logged out locally. Note: Remote session revocation was incomplete due to temporary service unavailability.',
      sessionRevoked,
    };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out of all devices' })
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    let sessionRevoked = true;
    if (req.user?.id) {
      sessionRevoked = await this.redisService.revokeAllSessions(req.user.id);
    }
    
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('__Host-AccessToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires: new Date(0),
    });
    if (!isProduction) {
      res.cookie('AccessToken', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        expires: new Date(0),
      });
    }
    return {
      message: sessionRevoked
        ? 'Logged out of all devices successfully'
        : 'Logged out locally. Note: Remote session revocation was incomplete due to temporary service unavailability.',
      sessionRevoked,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(@Req() req: any, @Body() body: any) {
    return this.authService.changePassword(req.user.id, body);
  }
}
