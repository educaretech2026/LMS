import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { FormsService } from './forms.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly storageService: StorageService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Post()
  createForm(@Body() createFormData: any): Promise<any> {
    return this.formsService.createForm(createFormData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get()
  getForms(): Promise<any> {
    return this.formsService.getForms();
  }

  // Public Endpoint to fetch form details
  @Get(':id')
  getFormById(@Param('id') id: string): Promise<any> {
    return this.formsService.getFormById(id);
  }

  // Public Endpoint for respondent to upload files directly
  @Get(':id/upload-url')
  async getUploadUrl(
    @Param('id') id: string,
    @Query('filename') filename: string,
    @Query('contentType') contentType: string
  ) {
    if (!filename || !contentType) {
      throw new Error('Filename and contentType are required');
    }
    // Prefix the file with the form id to keep storage organized
    const customFilename = `forms/${id}/${Date.now()}-${filename}`;
    return this.storageService.getPresignedUploadUrl(customFilename, contentType);
  }

  // Public Endpoint to submit a response
  @Post(':id/submit')
  submitResponse(@Param('id') formId: string, @Body() submissionData: any): Promise<any> {
    return this.formsService.submitResponse(formId, submissionData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get(':id/responses')
  getFormResponses(@Param('id') formId: string): Promise<any> {
    return this.formsService.getFormResponses(formId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Put(':id')
  updateForm(@Param('id') id: string, @Body() updateData: any): Promise<any> {
    return this.formsService.updateForm(id, updateData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Delete(':id')
  deleteForm(@Param('id') id: string): Promise<any> {
    return this.formsService.deleteForm(id);
  }
}
