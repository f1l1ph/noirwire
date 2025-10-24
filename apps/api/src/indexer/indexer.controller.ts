import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { IndexerService, MerkleProof } from './indexer.service';
import { BlockchainSyncService } from './blockchain-sync.service';
import {
  InvalidCircuitException,
  ValidationMissingFieldException,
  AppException,
} from '../common/exceptions';

/**
 * Indexer Controller - HTTP endpoints for Merkle proof queries
 *
 * Provides:
 * - GET /indexer/status - Check indexer status and tree sizes
 * - GET /indexer/sync-status - Check blockchain sync status
 * - GET /indexer/:circuit/root - Get current tree root for circuit
 * - POST /indexer/:circuit/proof - Get Merkle proof for commitment
 */
@Controller('indexer')
export class IndexerController {
  private readonly logger = new Logger(IndexerController.name);

  constructor(
    private indexerService: IndexerService,
    private blockchainSyncService: BlockchainSyncService,
  ) {}

  /**
   * Get indexer status
   * Useful for debugging and monitoring
   */
  @Get('status')
  getStatus() {
    this.logger.log('[Indexer] GET /status');
    return this.indexerService.getStatus();
  }

  /**
   * Get all commitments in a tree (for debugging)
   */
  @Get(':circuit/commitments')
  getCommitments(@Param('circuit') circuit: string) {
    this.logger.log(`[Indexer] GET /${circuit}/commitments`);

    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      throw new InvalidCircuitException(circuit);
    }

    return this.indexerService.getCommitments(
      circuit as 'shield' | 'transfer' | 'unshield',
    );
  }

  /**
   * Get blockchain sync status
   * Shows whether indexer is listening to on-chain events
   */
  @Get('sync-status')
  getSyncStatus() {
    this.logger.log('[Indexer] GET /sync-status');
    return this.blockchainSyncService.getStatus();
  }

  /**
   * Get Merkle root for a circuit
   * Used to validate tree state
   */
  @Get(':circuit/root')
  async getRoot(@Param('circuit') circuit: string): Promise<{ root: string }> {
    this.logger.log(`[Indexer] GET /${circuit}/root`);

    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      throw new InvalidCircuitException(circuit);
    }

    try {
      const root = await this.indexerService.getRoot(
        circuit as 'shield' | 'transfer' | 'unshield',
      );
      return { root };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      this.logger.error(
        `[Indexer] Error getting root for ${circuit}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get Merkle proof for a commitment
   * POST body: { commitment: string }
   * Returns: { root, path, pathPositions }
   */
  @Post(':circuit/proof')
  async getProof(
    @Param('circuit') circuit: string,
    @Body() body: { commitment: string },
  ): Promise<MerkleProof> {
    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      throw new InvalidCircuitException(circuit);
    }

    // Validate commitment BEFORE using it in logs
    if (!body || !body.commitment || typeof body.commitment !== 'string') {
      this.logger.warn(
        `[Indexer] POST /${circuit}/proof - invalid or missing commitment`,
      );
      throw new ValidationMissingFieldException('commitment');
    }

    this.logger.log(
      `[Indexer] POST /${circuit}/proof - commitment=${body.commitment.slice(0, 16)}...`,
    );

    try {
      const proof = await this.indexerService.getProof(
        circuit as 'shield' | 'transfer' | 'unshield',
        body.commitment,
      );

      this.logger.log(
        `[Indexer] Proof generated: root=${proof.root.slice(0, 16)}..., path_length=${proof.path.length}`,
      );

      return proof;
    } catch (error) {
      // Re-throw custom exceptions as-is
      if (error instanceof AppException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`[Indexer] Error generating proof: ${errorMessage}`);

      // For unknown errors, just re-throw
      throw error;
    }
  }

  /**
   * Add a commitment to the tree
   * Normally called by Shield transaction processor
   * POST body: { commitment: string }
   */
  @Post(':circuit/commit')
  async addCommitment(
    @Param('circuit') circuit: string,
    @Body() body: { commitment: string },
  ): Promise<{ success: boolean; root: string; index: number }> {
    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      throw new InvalidCircuitException(circuit);
    }

    // Validate commitment BEFORE using it in logs
    if (!body || !body.commitment || typeof body.commitment !== 'string') {
      this.logger.warn(
        `[Indexer] POST /${circuit}/commit - invalid or missing commitment`,
      );
      throw new ValidationMissingFieldException('commitment');
    }

    this.logger.log(
      `[Indexer] POST /${circuit}/commit - commitment=${body.commitment.slice(0, 16)}...`,
    );

    try {
      const result = await this.indexerService.addCommitment(
        circuit as 'shield' | 'transfer' | 'unshield',
        body.commitment,
      );

      if (circuit === 'shield' || circuit === 'transfer') {
        await this.blockchainSyncService.publishRoot(result.root);
      }

      this.logger.log(
        `[Indexer] Commitment added at index ${result.index}, new root: ${result.root.slice(0, 16)}...`,
      );

      return {
        success: true,
        root: result.root,
        index: result.index,
      };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `[Indexer] Error adding commitment: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Manually sync a commitment from Solana blockchain
   * Useful for:
   * - Initial setup / backfilling
   * - Catching up after downtime
   * - Testing
   *
   * POST body: { commitment: string, blockNumber?: number }
   */
  @Post(':circuit/sync')
  async syncCommitmentFromBlockchain(
    @Param('circuit') circuit: string,
    @Body() body: { commitment: string; blockNumber?: number },
  ): Promise<{ success: boolean; synced: boolean }> {
    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      throw new InvalidCircuitException(circuit);
    }

    // Validate commitment BEFORE using it in logs
    if (!body || !body.commitment || typeof body.commitment !== 'string') {
      this.logger.warn(
        `[Indexer] POST /${circuit}/sync - invalid or missing commitment`,
      );
      throw new ValidationMissingFieldException('commitment');
    }

    this.logger.log(
      `[Indexer] POST /${circuit}/sync - commitment=${body.commitment.slice(0, 16)}...`,
    );

    try {
      await this.blockchainSyncService.manuallyAddCommitment(
        circuit as 'shield' | 'transfer' | 'unshield',
        body.commitment,
        body.blockNumber,
      );

      return { success: true, synced: true };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.error(
        `[Indexer] Error syncing commitment: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
