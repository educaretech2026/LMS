import { Controller, Get, Patch, Post, Param, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any): Promise<any> {
    return this.notificationsService.getUserNotifications(req.user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Post('mark-all-read')
  async markAllAsRead(@Req() req: any): Promise<any> {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
