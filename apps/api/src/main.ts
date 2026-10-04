import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';
import { execSync } from 'child_process';
import { join } from 'path';

async function bootstrap() {
  // Automatically push the DB schema in production environments on startup
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    try {
      const dbDir = join(__dirname, '..', '..', '..', 'packages', 'database');
      console.log('Pushing database schema from:', dbDir);
      execSync('npx prisma db push --accept-data-loss', { cwd: dbDir, stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to push database schema automatically:', error);
    }
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

    const config = new DocumentBuilder()
    .setTitle('Educare LMS API')
    .setDescription('The Educare LMS API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  
  const customOptions = {
    customSiteTitle: 'Educare API Explorer',
    customCss: `
      .swagger-ui .topbar { background-color: #0162b1; }
      .swagger-ui .info hgroup.main { border-bottom: 2px solid #ee1b24; padding-bottom: 10px; }
      .swagger-ui .info .title { color: #0162b1; font-family: "Inter", sans-serif; font-weight: bold; }
      .swagger-ui .opblock.opblock-get .opblock-summary { background-color: rgba(1, 98, 177, 0.05); }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background-color: #0162b1; }
      .swagger-ui .opblock.opblock-post .opblock-summary { background-color: rgba(22, 163, 74, 0.05); }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background-color: #16a34a; }
      .swagger-ui .opblock.opblock-delete .opblock-summary { background-color: rgba(238, 27, 36, 0.05); }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method { background-color: #ee1b24; }
      .swagger-ui .opblock.opblock-put .opblock-summary { background-color: rgba(217, 119, 6, 0.05); }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background-color: #d97706; }
      body { font-family: "Inter", sans-serif; background-color: #FAFAF8; }
      .swagger-ui .wrapper { max-width: 1200px; margin: 0 auto; padding: 20px; }
      .swagger-ui .opblock { border-radius: 8px; border: 1px solid #E8E8E4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    `,
  };

  SwaggerModule.setup('api/docs', app, document, customOptions);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
