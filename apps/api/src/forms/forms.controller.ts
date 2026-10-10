import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { FormsService } from './forms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Post()
  createForm(@Body() createFormData: any) {
    return this.formsService.createForm(createFormData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get()
  getForms() {
    return this.formsService.getForms();
  }

  // Public Endpoint to fetch form details
  @Get(':id')
  getFormById(@Param('id') id: string) {
    return this.formsService.getFormById(id);
  }

  // Public Endpoint to submit a response
  @Post(':id/submit')
  submitResponse(@Param('id') formId: string, @Body() submissionData: any) {
    return this.formsService.submitResponse(formId, submissionData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get(':id/responses')
  getFormResponses(@Param('id') formId: string) {
    return this.formsService.getFormResponses(formId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Put(':id')
  updateForm(@Param('id') id: string, @Body() updateData: any) {
    return this.formsService.updateForm(id, updateData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Delete(':id')
  deleteForm(@Param('id') id: string) {
    return this.formsService.deleteForm(id);
  }
}
