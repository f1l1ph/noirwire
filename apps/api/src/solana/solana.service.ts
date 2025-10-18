import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection;
  private readonly programId: PublicKey;
  private readonly adminKeypair?: Keypair;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl =
      this.configService.get<string>('SOLANA_RPC_URL') ||
      'https://api.devnet.solana.com';
    const commitment =
      (this.configService.get<string>('SOLANA_COMMITMENT') as Commitment) ||
      'processed';

    this.connection = new Connection(rpcUrl, commitment);
    const programId =
      this.configService.get<string>('NOIRWIRE_PROGRAM_ID') ||
      'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz';
    this.programId = new PublicKey(programId);
    this.adminKeypair = this.loadAdminKeypair();
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getProgramId(): PublicKey {
    return this.programId;
  }

  public getAdminKeypair(): Keypair | undefined {
    return this.adminKeypair;
  }

  private loadAdminKeypair(): Keypair | undefined {
    const secret = this.configService.get<string>('SOLANA_ADMIN_KEYPAIR');
    if (!secret) {
      this.logger.warn(
        '[SolanaService] SOLANA_ADMIN_KEYPAIR not configured - root publishing disabled',
      );
      return undefined;
    }

    try {
      if (secret.trim().startsWith('[')) {
        const parsed = JSON.parse(secret.trim()) as number[];
        if (!Array.isArray(parsed)) {
          throw new Error('Admin keypair JSON must be an array of numbers');
        }
        const decoded = Uint8Array.from(parsed);
        const kp = Keypair.fromSecretKey(decoded);
        this.logger.log(
          `[SolanaService] Admin keypair loaded: ${kp.publicKey.toBase58()}`,
        );
        return kp;
      }

      // Try base58 decode (common for Solana CLI exports)
      const decoded = bs58.decode(secret.trim());
      const kp = Keypair.fromSecretKey(decoded);
      this.logger.log(
        `[SolanaService] Admin keypair loaded: ${kp.publicKey.toBase58()}`,
      );
      return kp;
    } catch (error) {
      this.logger.error(
        `[SolanaService] Failed to parse SOLANA_ADMIN_KEYPAIR: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
}
