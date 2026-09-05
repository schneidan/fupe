import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  assertProductionAuthSafety,
  isGraphqlEnabled,
  isSwaggerEnabled,
  resolveJwtSecret,
} from './common/security';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Needed for Stripe webhook signature verification
    rawBody: true,
  });

  const config = app.get(ConfigService);
  resolveJwtSecret(config);
  assertProductionAuthSafety(config);

  // Cloudflare / nginx terminate TLS — trust X-Forwarded-* for IP throttle + logs
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
  };
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      // API is often called cross-origin from the web app; keep CSP off here.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['graphql', 'health'],
  });

  if (isSwaggerEnabled()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FUPE API')
      .setDescription(
        [
          'Find Ultimate Parent Entity — ownership lookup with citation-backed chains.',
          '',
          '**Auth:** pass `X-API-Key: fupe_…` (create keys on the Developers page).',
          'First-party web/mobile may omit a key unless `REQUIRE_API_KEY=true`.',
          '',
          '**Tiers (keyed requests):** Free 100/day (no IMAGE); Developer 10k/day + IMAGE; Business custom.',
        ].join('\n'),
      )
      .setVersion('0.1')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API key from /developers (prefix `fupe_`)',
        },
        'api-key',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'User JWT from /api/v1/auth/login (manage keys, billing)',
        },
        'bearer',
      )
      .addTag('Lookup', 'PE ownership resolution')
      .addTag('Entities', 'Directory browse & related')
      .addTag('API keys', 'Create and revoke keys (JWT)')
      .addTag('Health', 'Liveness')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      customSiteTitle: 'FUPE API docs',
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`FUPE API listening on http://localhost:${port}`);
  if (isSwaggerEnabled()) {
    console.log(`OpenAPI docs: http://localhost:${port}/api/docs`);
  } else {
    console.log('OpenAPI docs: disabled (set ENABLE_SWAGGER=true to enable)');
  }
  if (isGraphqlEnabled()) {
    console.log(`GraphQL: http://localhost:${port}/graphql`);
  } else {
    console.log('GraphQL: disabled (set ENABLE_GRAPHQL=true to enable)');
  }
}

bootstrap();
