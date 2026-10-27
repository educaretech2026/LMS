import { Controller, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Req() req: any, @Body() data: any) {
    return this.usersService.updateProfile(req.user.id, data);
  }

  @Get(':id/module-access')
  @ApiOperation({ summary: 'Get user module permissions (Super Admin only)' })
  getUserModuleAccess(@Param('id') id: string, @Req() req: any) {
    return this.usersService.getUserModuleAccess(id, req.user);
  }

  @Put(':id/module-access')
  @ApiOperation({ summary: 'Update user module permissions (Super Admin only)' })
  updateUserModuleAccess(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.usersService.updateUserModuleAccess(id, data?.modules ?? null, req.user);
  }
}

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Req() req: any, @Body() data: any) {
    return this.usersService.updateProfile(req.user.id, data);
  }
}
