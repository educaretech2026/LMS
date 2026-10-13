import { Controller, Get, Patch, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
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

  @Delete('clear-read')
  async clearRead(@Req() req: any): Promise<any> {
    return this.notificationsService.clearReadNotifications(req.user.id);
  }

  @Delete('clear-all')
  async clearAll(@Req() req: any): Promise<any> {
    return this.notificationsService.clearAllNotifications(req.user.id);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.notificationsService.deleteNotification(id, req.user.id);
  }
}
