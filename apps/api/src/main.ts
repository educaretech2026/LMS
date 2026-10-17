import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // SEC-09: HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger and Next.js SPA use inline assets; CSP can be tailored per domain
      crossOriginEmbedderPolicy: false,
    }),
  );

  // SEC-06: Strict CORS allowlist with credentials - exclude localhost in production
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (isProduction && configuredOrigins.length === 0) {
    console.warn('⚠️ WARNING: In production, CORS_ORIGINS must be explicitly set with trusted domain names.');
  }

  const devOrigins = isProduction
    ? []
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];
  const allowedOrigins = Array.from(new Set([...devOrigins, ...configuredOrigins]));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like native mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!isProduction && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
