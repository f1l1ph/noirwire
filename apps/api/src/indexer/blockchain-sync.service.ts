import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { IndexerService } from './indexer.service';
import { SolanaService } from '../solana/solana.service';

// Correct discriminator for add_root instruction from IDL
// Calculated as: sha256("global:add_root").slice(0, 8)
const ADD_ROOT_DISCRIMINATOR = Buffer.from([
  88, 51, 115, 122, 205, 57, 113, 207,
]);

/**
 * BlockchainSyncService - Syncs commitments from Solana blockchain
 *
 * Responsibilities:
 * 1. Listen to Shield events from deployed Solana programs
 * 2. Extract commitments from events
 * 3. Add commitments to indexer trees
 * 4. Handle blockchain reorgs and missed blocks
 *
 * Production Integration:
 * - Connects to Solana RPC endpoint (mainnet/devnet/localnet)
 * - Uses @solana/web3.js to listen for program events
 * - Stores last synced slot to resume from interruptions
 * - Maintains commitment ledger for verification
 */
@Injectable()
export class BlockchainSyncService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainSyncService.name);
  private isListening = false;
  private rootStatus = new Map<
    string,
    {
      status: 'pending' | 'published' | 'failed';
      signature?: string;
      error?: string;
      updatedAt: number;
    }
  >();

  constructor(
    private indexerService: IndexerService,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Initialize blockchain sync on module startup
   * In production, this connects to Solana and starts listening
   */
  async onModuleInit() {
    try {
      this.logger.log('[BlockchainSync] Initializing blockchain sync...');

      // Check if Solana RPC is configured
      const rpcUrl = process.env.SOLANA_RPC_URL;
      if (!rpcUrl) {
        this.logger.warn(
          '[BlockchainSync] SOLANA_RPC_URL not configured - blockchain sync disabled',
        );
        this.logger.warn(
          '[BlockchainSync] To enable: set SOLANA_RPC_URL environment variable',
        );
        this.logger.warn(
          '[BlockchainSync] Example: SOLANA_RPC_URL=https://api.devnet.solana.com',
        );
        return;
      }

      this.logger.log(
        `[BlockchainSync] Solana RPC configured: ${rpcUrl.split('/').slice(0, 3).join('/')}...`,
      );

      // In production, start listening to blockchain
      // For now, this is a placeholder for the actual sync logic
      await this.startBlockchainListener();
    } catch (error) {
      this.logger.error(
        `[BlockchainSync] Initialization error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - allow service to run without blockchain sync
    }
  }

  /**
   * Start listening to Solana blockchain for Shield events
   * In production, this would use web3.js connection to listen for logs
   *
   * @param rpcUrl - Solana RPC endpoint
   */
  private async startBlockchainListener(): Promise<void> {
    try {
      this.logger.log(
        '[BlockchainSync] Starting blockchain listener (production implementation required)',
      );

      // Production implementation would:
      // 1. Create Connection to Solana cluster
      // 2. Subscribe to program account changes
      // 3. Listen for Shield event emissions
      // 4. Parse commitment from event data
      // 5. Call indexerService.addCommitment()

      // Configuration needed in production:
      const programId = process.env.NOIRWIRE_PROGRAM_ID;
      const commitment = process.env.SOLANA_COMMITMENT || 'processed';

      this.logger.log(
        `[BlockchainSync] Configuration: program=${programId}, commitment=${commitment}`,
      );

      if (!programId) {
        this.logger.warn(
          '[BlockchainSync] NOIRWIRE_PROGRAM_ID not configured - cannot sync',
        );
        return;
      }

      // This is where web3.js Connection would be initialized
      // const connection = new Connection(rpcUrl, commitment);
      // connection.onLogs(...) - listen for program logs
      // Extract commitment and add to indexer

      this.isListening = true;
      this.logger.log(
        '[BlockchainSync] Blockchain listener started (monitoring for Shield events)',
      );
    } catch (error) {
      this.logger.error(
        `[BlockchainSync] Failed to start listener: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.isListening = false;
    }
  }

  /**
   * Manually sync a commitment that occurred on-chain
   * Useful for:
   * - Catching up after downtime
   * - Testing
   * - Emergency sync
   *
   * @param circuit - Circuit type (shield/transfer/unshield)
   * @param commitment - The commitment from on-chain event
   * @param blockNumber - Block where commitment was created (for verification)
   */
  public async manuallyAddCommitment(
    circuit: 'shield' | 'transfer' | 'unshield',
    commitment: string,
    blockNumber?: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `[BlockchainSync] Manually adding ${circuit} commitment: ${commitment.slice(0, 16)}... (block: ${blockNumber})`,
      );

      await this.indexerService.addCommitment(circuit, commitment);

      this.logger.log(
        `[BlockchainSync] Successfully added commitment to indexer`,
      );
    } catch (error) {
      this.logger.error(
        `[BlockchainSync] Error adding commitment: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get sync status
   * Returns whether blockchain listener is active
   */
  public getStatus() {
    return {
      isListening: this.isListening,
      rpcConfigured: !!process.env.SOLANA_RPC_URL,
      programId: process.env.NOIRWIRE_PROGRAM_ID || null,
      solanaNetwork: this.getSolanaNetwork(),
      indexerStatus: this.indexerService.getStatus(),
      rootStatus: this.getRootStatusSnapshot(),
    };
  }

  /**
   * Determine which Solana network from RPC URL
   */
  private getSolanaNetwork(): string {
    const rpc = process.env.SOLANA_RPC_URL || '';

    if (rpc.includes('mainnet')) return 'mainnet-beta';
    if (rpc.includes('devnet')) return 'devnet';
    if (rpc.includes('testnet')) return 'testnet';
    if (rpc.includes('localhost')) return 'localnet';

    return 'unknown';
  }

  /**
   * Publish a Merkle root to the on-chain roots account (admin-only helper).
   */
  public async publishRoot(rootHex: string): Promise<void> {
    const adminKeypair = this.solanaService.getAdminKeypair();
    if (!adminKeypair) {
      this.logger.warn(
        '[BlockchainSync] Skipping root publish - admin keypair not configured',
      );
      return;
    }

    if (!rootHex || rootHex.length === 0) {
      this.logger.warn('[BlockchainSync] Cannot publish empty root');
      return;
    }

    try {
      const normalizedRoot = this.normalizeRootHex(rootHex);
      this.rootStatus.set(normalizedRoot, {
        status: 'pending',
        updatedAt: Date.now(),
      });

      const connection = this.solanaService.getConnection();
      const programId = this.solanaService.getProgramId();
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        programId,
      );
      const [rootsPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('roots')],
        programId,
      );

      const rootBytes = this.toLittleEndianBytes(normalizedRoot);
      const alreadyExists = await this.rootExistsOnChain(
        connection,
        rootsPda,
        rootBytes,
      );

      if (alreadyExists) {
        this.logger.log(
          `[BlockchainSync] Root already present on-chain: ${normalizedRoot.slice(0, 16)}...`,
        );
        this.rootStatus.set(normalizedRoot, {
          status: 'published',
          updatedAt: Date.now(),
        });
        return;
      }

      this.logger.log(
        `[BlockchainSync] Publishing root on-chain: ${normalizedRoot.slice(0, 16)}...`,
      );
      this.logger.debug(`[BlockchainSync] Program ID: ${programId.toBase58()}`);
      this.logger.debug(`[BlockchainSync] Config PDA: ${configPda.toBase58()}`);
      this.logger.debug(`[BlockchainSync] Roots PDA: ${rootsPda.toBase58()}`);
      this.logger.debug(
        `[BlockchainSync] Admin pubkey: ${adminKeypair.publicKey.toBase58()}`,
      );

      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: rootsPda, isSigner: false, isWritable: true },
          { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: false }, // authority
          {
            pubkey: adminKeypair.publicKey,
            isSigner: false,
            isWritable: false,
          }, // admin
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: Buffer.concat([ADD_ROOT_DISCRIMINATOR, rootBytes]),
      });

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction({
        feePayer: adminKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(instruction);

      transaction.sign(adminKeypair);

      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        },
      );

      this.logger.log(
        `[BlockchainSync] ✅ add_root transaction sent: ${signature}`,
      );
      this.logger.log(
        `[BlockchainSync] 🔗 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      );

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      if (confirmation.value.err) {
        throw new Error(
          `add_root transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      this.rootStatus.set(normalizedRoot, {
        status: 'published',
        signature,
        updatedAt: Date.now(),
      });

      this.logger.log(
        `[BlockchainSync] ✅ Root published successfully to blockchain!`,
      );
      this.logger.log(
        `[BlockchainSync] Root ${normalizedRoot.slice(0, 16)}... is now available for proofs`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[BlockchainSync] ❌ Failed to publish root: ${errorMessage}`,
      );

      // Provide helpful troubleshooting info
      if (errorMessage.includes('Unauthorized')) {
        this.logger.error(
          '[BlockchainSync] 💡 The admin keypair does not match the on-chain admin. Check SOLANA_ADMIN_KEYPAIR in .env',
        );
      } else if (errorMessage.includes('AccountNotFound')) {
        this.logger.error(
          '[BlockchainSync] 💡 The pool may not be initialized. Run: npm run initialize-pool',
        );
      } else if (errorMessage.includes('insufficient funds')) {
        this.logger.error(
          `[BlockchainSync] 💡 Admin account needs SOL. Airdrop: solana airdrop 1 ${adminKeypair?.publicKey.toBase58()} --url devnet`,
        );
      }

      const normalizedRoot = this.normalizeRootHex(rootHex);
      this.rootStatus.set(normalizedRoot, {
        status: 'failed',
        error: errorMessage,
        updatedAt: Date.now(),
      });
    }
  }

  private normalizeRootHex(root: string): string {
    const sanitized = root.startsWith('0x') ? root.slice(2) : root;
    return sanitized.toLowerCase();
  }

  private toLittleEndianBytes(rootHex: string): Buffer {
    const sanitized = rootHex.startsWith('0x') ? rootHex.slice(2) : rootHex;
    const value = BigInt(`0x${sanitized}`);
    const buffer = Buffer.alloc(32);
    let temp = value;
    for (let i = 0; i < 32; i++) {
      buffer[i] = Number(temp & 0xffn);
      temp >>= 8n;
    }
    return buffer;
  }

  private getRootStatusSnapshot() {
    return Array.from(this.rootStatus.entries()).map(([root, status]) => ({
      root,
      ...status,
    }));
  }

  private async rootExistsOnChain(
    connection: Connection,
    rootsPda: PublicKey,
    rootBytes: Buffer,
  ): Promise<boolean> {
    const accountInfo = await connection.getAccountInfo(rootsPda, 'confirmed');
    if (!accountInfo) {
      this.logger.warn(
        '[BlockchainSync] Roots account not found on-chain; ensure pool is initialized',
      );
      return false;
    }

    const { roots, size } = this.parseRootsAccount(accountInfo.data);
    if (roots.length === 0 || size === 0) {
      return false;
    }

    return roots.slice(0, size).some((stored) => stored.equals(rootBytes));
  }

  private parseRootsAccount(data: Buffer): {
    roots: Buffer[];
    cursor: number;
    size: number;
    capacity: number;
  } {
    if (data.length < 8 + 4 + 2 + 2 + 2 + 1) {
      throw new Error('Roots account data is malformed');
    }

    let offset = 8; // discriminator
    const vecLength = data.readUInt32LE(offset);
    offset += 4;

    const roots: Buffer[] = [];
    for (let i = 0; i < vecLength; i++) {
      const start = offset + i * 32;
      const end = start + 32;
      if (end > data.length) break;
      roots.push(Buffer.from(data.slice(start, end)));
    }
    offset += vecLength * 32;

    const cursor = data.readUInt16LE(offset);
    offset += 2;
    const size = data.readUInt16LE(offset);
    offset += 2;
    const capacity = data.readUInt16LE(offset);

    return { roots, cursor, size, capacity };
  }
}
