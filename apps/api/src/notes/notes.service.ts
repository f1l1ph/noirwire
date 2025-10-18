import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadNotes(
    walletAddress: string,
    encryptedData: string,
  ): Promise<void> {
    return this.supabaseService.uploadNotes(walletAddress, encryptedData);
  }

  async downloadNotes(walletAddress: string): Promise<string | null> {
    return this.supabaseService.downloadNotes(walletAddress);
  }

  isSupabaseConfigured(): boolean {
    return this.supabaseService.isConfigured();
  }
}
