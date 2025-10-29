import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService, SupabaseService],
})
export class NewsletterModule {}
