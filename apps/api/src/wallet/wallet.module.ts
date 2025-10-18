import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  providers: [WalletService, SupabaseService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
