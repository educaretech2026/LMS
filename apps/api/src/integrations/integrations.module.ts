import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { DatabaseModule } from '../database/database.module';
import { ApiKeyWebhookGuard } from './guards/api-key-webhook.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ApiKeyWebhookGuard],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}

