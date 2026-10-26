import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { EnquiryService } from './enquiry.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';
import { StrictThrottlerGuard } from '../common/guards/strict-throttler.guard';

@Controller('enquiry')
@Permissions('ENQUIRY')
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  @Public()
  @UseGuards(StrictThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('public')
  createPublic(@Body() data: any, @Req() req: any) {
    return this.enquiryService.createPublicEnquiry(data, req?.ip);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Post()
  create(@Body() data: any, @Req() req: any) {
    return this.enquiryService.createEnquiry(data, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get()
  getAll(@Req() req: any) {
    return this.enquiryService.getAllEnquiries(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('summary')
  getSummary(@Req() req: any) {
    return this.enquiryService.getEnquirySummary(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('unreconciled')
  getUnreconciled(@Req() req: any) {
    return this.enquiryService.getUnreconciledEnquiries(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post(':id/reconcile')
  reconcile(
    @Param('id') id: string,
    @Body() body: { centreId: string; reason?: string },
    @Req() req: any,
  ) {
    return this.enquiryService.reconcileEnquiry(id, body?.centreId, req.user, body?.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.enquiryService.updateEnquiry(id, data, req.user);
  }
}

