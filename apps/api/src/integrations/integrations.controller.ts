import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { ApiKeyWebhookGuard } from './guards/api-key-webhook.guard';
import { Public } from '../common/decorators/public.decorator';
import { CrmAdmissionWebhookDto } from './dto/crm-webhook.dto';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * INCOMING WEBHOOK: Triggered by external CRM on student ENROLLED / opportunity WON.
   * Authenticated via X-API-Key and HMAC SHA-256 X-Webhook-Signature.
   * Hardened with anti-replay timestamp verification and dedicated ingress throttling.
   */
  @Public()
  @UseGuards(ApiKeyWebhookGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('webhooks/crm/admissions')
  @HttpCode(HttpStatus.OK)
  async handleCrmAdmissionWebhook(
    @Body() payload: CrmAdmissionWebhookDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.integrationsService.processCrmAdmissionWebhook(
      payload,
      req.integration,
      ip,
    );
  }

  /**
   * ADMIN SETTINGS: Get current API key and webhook credentials.
   */
  @Get('integrations/credentials')
  async getCredentials(@Query('centreId') centreId?: string) {
    return this.integrationsService.getOrCreateIntegration(centreId);
  }

  /**
   * ADMIN SETTINGS: Regenerate API key and webhook secret.
   */
  @Post('integrations/credentials/:id/regenerate')
  async regenerateCredentials(@Param('id') id: string) {
    return this.integrationsService.regenerateCredentials(id);
  }

  /**
   * ADMIN / STAFF: Get dedicated CRM-enrolled admissions list and stats.
   */
  @Get('integrations/crm-admissions')
  async getCrmAdmissions(
    @Query('centreId') centreId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.getCrmAdmissions({
      centreId,
      search,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * ADMIN: Permanently delete a CRM admission record and purge associated student test data.
   */
  @Delete('integrations/crm-admissions/:id')
  async deleteCrmAdmission(@Param('id') id: string) {
    return this.integrationsService.deleteCrmAdmission(id);
  }

  /**
   * ADMIN: Get latest webhook activity and delivery audit logs.
   */
  @Get('integrations/logs')
  async getWebhookLogs(@Query('limit') limit?: string): Promise<any[]> {
    return this.integrationsService.getWebhookLogs(
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * ADMIN: Clear all webhook activity and delivery audit logs.
   */
  @Delete('integrations/logs')
  async clearWebhookLogs() {
    return this.integrationsService.clearWebhookLogs();
  }
}
