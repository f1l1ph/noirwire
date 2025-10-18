import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    this.logger.log(
      `Supabase config check: URL=${!!supabaseUrl}, KEY=${!!supabaseServiceKey}`,
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.warn(
        'Supabase credentials not configured. Notes sync will be unavailable.',
      );
      this.supabase = null;
      return;
    }

    try {
      // Use service role key for server-side operations (bypasses RLS)
      this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      this.logger.log('✅ Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error);
      this.supabase = null;
    }
  }

  /**
   * Upload encrypted notes for a wallet
   * Uses a two-step approach: try update first, then insert if not found
   */
  async uploadNotes(
    walletAddress: string,
    encryptedData: string,
  ): Promise<void> {
    this.logger.debug('=== SUPABASE UPLOAD START ===');
    this.logger.debug(`Wallet: ${walletAddress}`);
    this.logger.debug(`Data length: ${encryptedData?.length || 0} chars`);

    if (!this.supabase) {
      this.logger.error('⚠️ Supabase not configured - cannot upload notes');
      this.logger.error(
        'Please check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env',
      );
      this.logger.error(`SUPABASE_URL exists: ${!!process.env.SUPABASE_URL}`);
      this.logger.error(
        `SUPABASE_SERVICE_KEY exists: ${!!process.env.SUPABASE_SERVICE_KEY}`,
      );
      throw new Error(
        'Supabase not configured. Check server logs for details.',
      );
    }

    try {
      this.logger.log(
        `📤 Attempting to upload notes for wallet: ${walletAddress.slice(0, 8)}...`,
      );

      // First, try to check if record exists
      this.logger.debug('Step 1: Checking if record exists...');
      const { data: existingRecord, error: checkError } = await this.supabase
        .from('user_notes')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (checkError) {
        this.logger.error('❌ ERROR CHECKING EXISTING RECORD:');
        this.logger.error(`   Code: ${checkError.code}`);
        this.logger.error(`   Message: ${checkError.message}`);

        if (checkError.code === '42P01') {
          this.logger.error('❌ TABLE DOES NOT EXIST!');
          this.logger.error('   Run this SQL in Supabase Dashboard:');
          this.logger.error(
            '   https://app.supabase.com/project/dgqixmxvqhlpbmusdfdg/sql/new',
          );
          this.logger.error('   See: supabase-schema.sql');
          throw new Error(
            'Table "user_notes" does not exist. Please run supabase-schema.sql in your Supabase SQL Editor.',
          );
        }

        throw new Error(
          `Database check error [${checkError.code}]: ${checkError.message}`,
        );
      }

      // If record exists, UPDATE it
      if (existingRecord) {
        this.logger.debug(
          `Step 2a: Record exists (ID: ${existingRecord.id}), updating...`,
        );
        const { error: updateError } = await this.supabase
          .from('user_notes')
          .update({
            encrypted_data: encryptedData,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', walletAddress);

        if (updateError) {
          this.logger.error('❌ UPDATE ERROR:');
          this.logger.error(`   Code: ${updateError.code}`);
          this.logger.error(`   Message: ${updateError.message}`);
          throw new Error(
            `Failed to update notes [${updateError.code}]: ${updateError.message}`,
          );
        }

        this.logger.log(
          `✅ Notes updated successfully for wallet ${walletAddress.slice(0, 8)}...`,
        );
      } else {
        // Record doesn't exist, INSERT it
        this.logger.debug('Step 2b: Record does not exist, inserting...');
        const { error: insertError } = await this.supabase
          .from('user_notes')
          .insert({
            wallet_address: walletAddress,
            encrypted_data: encryptedData,
          });

        if (insertError) {
          this.logger.error('❌ INSERT ERROR:');
          this.logger.error(`   Code: ${insertError.code}`);
          this.logger.error(`   Message: ${insertError.message}`);

          if (insertError.code === '23505') {
            this.logger.error(
              '❌ DUPLICATE KEY - Record was created by another request',
            );
            this.logger.debug('Retrying with UPDATE...');
            // Race condition - another request inserted the record, retry with update
            return this.uploadNotes(walletAddress, encryptedData);
          }

          throw new Error(
            `Failed to insert notes [${insertError.code}]: ${insertError.message}`,
          );
        }

        this.logger.log(
          `✅ Notes inserted successfully for wallet ${walletAddress.slice(0, 8)}...`,
        );
      }

      this.logger.debug('=== SUPABASE UPLOAD END ===');
    } catch (error) {
      this.logger.error('=== SUPABASE UPLOAD FAILED ===');
      this.logger.error(`Error type: ${error?.constructor?.name}`);
      this.logger.error(
        `Error message: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error(`Full error: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }
  }

  /**
   * Download encrypted notes for a wallet
   */
  async downloadNotes(walletAddress: string): Promise<string | null> {
    if (!this.supabase) {
      this.logger.warn('Supabase not configured - skipping notes download');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('user_notes')
        .select('encrypted_data')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No notes found - this is not an error
          this.logger.log(
            `No notes found for wallet ${walletAddress.slice(0, 8)}...`,
          );
          return null;
        }
        this.logger.error('Failed to download notes', error);
        throw new Error(`Failed to download notes: ${error.message}`);
      }

      this.logger.log(
        `✅ Notes downloaded for wallet ${walletAddress.slice(0, 8)}...`,
      );
      return data?.encrypted_data || null;
    } catch (error) {
      this.logger.error('Error downloading notes:', error);
      throw error;
    }
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    const configured = this.supabase !== null;
    this.logger.debug(`Supabase configured: ${configured}`);
    return configured;
  }
}
