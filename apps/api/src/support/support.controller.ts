import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(@Req() req: any, @Body() body: { subject: string; description: string }) {
    return this.supportService.createTicket(req.user.id, body.subject, body.description);
  }

  @Get('tickets/me')
  @ApiOperation({ summary: 'Get current user support tickets' })
  getMyTickets(@Req() req: any) {
    return this.supportService.getMyTickets(req.user.id);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('tickets')
  @ApiOperation({ summary: 'Get all support tickets (admin only)' })
  getAllTickets() {
    return this.supportService.getAllTickets();
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Put('tickets/:id/status')
  @ApiOperation({ summary: 'Update support ticket status' })
  updateTicketStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateTicketStatus(id, body.status);
  }
}
