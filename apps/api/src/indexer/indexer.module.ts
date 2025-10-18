import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { IndexerController } from './indexer.controller';
import { BlockchainSyncService } from './blockchain-sync.service';
import { SolanaService } from '../solana/solana.service';

@Module({
  providers: [IndexerService, BlockchainSyncService, SolanaService],
  controllers: [IndexerController],
  exports: [IndexerService, BlockchainSyncService],
})
export class IndexerModule {}
