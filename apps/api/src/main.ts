import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpLoggingFilter } from './common/http-logging.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register global exception filter for logging
  app.useGlobalFilters(new HttpLoggingFilter());

  // CORS configuration - supports both local and production
  const config = await import('../../../config.json');
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : config.cors.allowedOrigins;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Use PORT from environment (Railway, Render, etc.) or default to 3000
  const port = process.env.PORT || 3000;

  await app.listen(port);

  // Startup logging
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          🚀 NoirWire API Server Started                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Port: ${port}`);
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`📊 Request logging enabled with request IDs`);

  // Supabase status
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_KEY;

  if (hasSupabaseUrl && hasSupabaseKey) {
    console.log('✅ Supabase configured - notes storage ENABLED');
  } else {
    console.log('⚠️  Supabase NOT configured:');
    if (!hasSupabaseUrl) console.log('   - Missing: SUPABASE_URL');
    if (!hasSupabaseKey) console.log('   - Missing: SUPABASE_SERVICE_KEY');
    console.log('   See SUPABASE_VERIFICATION.md for setup instructions');
  }

  console.log('');
}

void bootstrap();
