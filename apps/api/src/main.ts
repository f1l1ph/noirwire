import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration - supports both local and production
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3001', 'http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Use PORT from environment (Railway, Render, etc.) or default to 3000
  const port = process.env.PORT || 3000;

  await app.listen(port);
  console.log(`🚀 API server running on http://localhost:${port}`);
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
}

void bootstrap();
