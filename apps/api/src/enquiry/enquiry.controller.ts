import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { EnquiryService } from './enquiry.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { Public } from '../common/decorators/public.decorator';

@Controller('enquiry')
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  @Public()
  @Post('public')
  createPublic(@Body() data: any) {
    return this.enquiryService.createEnquiry({ ...data, source: data.source || 'Website Form' });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Post()
  create(@Body() data: any) {
    return this.enquiryService.createEnquiry(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get()
  getAll() {
    return this.enquiryService.getAllEnquiries();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('summary')
  getSummary() {
    return this.enquiryService.getEnquirySummary();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.enquiryService.updateEnquiry(id, data);
  }
}
