import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [NotesController],
  providers: [NotesService, SupabaseService],
})
export class NotesModule {}
