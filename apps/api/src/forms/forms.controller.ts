import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query, Req, BadRequestException } from '@nestjs/common';
import { FormsService } from './forms.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as path from 'path';

const DISALLOWED_FORM_MIME_TYPES = [
  'text/html',
  'image/svg+xml',
  'application/x-sh',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/xhtml+xml',
  'application/x-httpd-php',
];

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly storageService: StorageService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Post()
  createForm(@Body() createFormData: any, @Req() req: any): Promise<any> {
    return this.formsService.createForm(createFormData, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get()
  getForms(@Req() req: any): Promise<any> {
    return this.formsService.getForms(req.user);
  }

  // Public Endpoint to fetch form details
  @Public()
  @Get(':id')
  getFormById(@Param('id') id: string): Promise<any> {
    return this.formsService.getFormById(id);
  }

  // Public Endpoint for respondent to upload files directly
  @Public()
  @Get(':id/upload-url')
  async getUploadUrl(
    @Param('id') id: string,
    @Query('filename') filename: string,
    @Query('contentType') contentType: string
  ) {
    if (!filename || !contentType) {
      throw new BadRequestException('Filename and contentType are required');
    }

    if (DISALLOWED_FORM_MIME_TYPES.includes(contentType.toLowerCase())) {
      throw new BadRequestException(`Uploading files of type "${contentType}" is not permitted for security reasons.`);
    }

    // Ensure form exists and is active
    const form = await this.formsService.getFormById(id);
    if (!form || !form.isActive) {
      throw new BadRequestException('Form is not active or does not exist');
    }

    // Prefix the file with the form id to keep storage organized
    const safeBaseName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const customFilename = `forms/${id}/${Date.now()}-${safeBaseName}`;
    return this.storageService.getPresignedUploadUrl(customFilename, contentType);
  }

  // Public Endpoint to submit a response
  @Public()
  @Post(':id/submit')
  submitResponse(@Param('id') formId: string, @Body() submissionData: any): Promise<any> {
    return this.formsService.submitResponse(formId, submissionData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Get(':id/responses')
  getFormResponses(@Param('id') formId: string, @Req() req: any): Promise<any> {
    return this.formsService.getFormResponses(formId, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Put(':id')
  updateForm(@Param('id') id: string, @Body() updateData: any, @Req() req: any): Promise<any> {
    return this.formsService.updateForm(id, updateData, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'CENTRE_HEAD', 'ADMIN')
  @Delete(':id')
  deleteForm(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.formsService.deleteForm(id, req.user);
  }
}
