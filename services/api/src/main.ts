import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Needed for Stripe webhook signature verification
    rawBody: true,
  });

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`FUPE API listening on http://localhost:${port}`);
  console.log(`GraphQL playground: http://localhost:${port}/graphql`);
}

bootstrap();
