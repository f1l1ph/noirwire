// apps/web/lib/transactionUtils.ts
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import type { SignerWalletAdapter } from '@solana/wallet-adapter-base';

/**
 * Build, sign, and send a Solana transaction
 * Centralized transaction handling to ensure consistency
 */
export const buildAndSendTransaction = async (
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: SignerWalletAdapter['signTransaction'],
  instruction: TransactionInstruction,
): Promise<string> => {
  if (!signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');

  // Build transaction
  const transaction = new Transaction({
    feePayer: publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(instruction);

  // Sign transaction
  const signed = await signTransaction(transaction);

  // Send transaction
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });

  return signature;
};

/**
 * Confirm a transaction
 * Waits for confirmation and throws if transaction failed
 */
export const confirmTransaction = async (
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> => {
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  if (confirmation.value.err) {
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }
};

/**
 * Complete transaction flow: build, send, confirm
 */
export const executeTransaction = async (
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: SignerWalletAdapter['signTransaction'],
  instruction: TransactionInstruction,
  onStatusChange?: (status: string) => void,
): Promise<string> => {
  onStatusChange?.('Building transaction...');

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');

  // Build transaction
  const transaction = new Transaction({
    feePayer: publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(instruction);

  onStatusChange?.('Sending transaction to network...');

  if (!signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }

  // Sign and send
  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });

  onStatusChange?.('Confirming transaction...');

  // Confirm
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  if (confirmation.value.err) {
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  return signature;
};

/**
 * Derive Program Derived Addresses
 * Centralized PDA derivation for consistency
 */
export const PROGRAM_ID = new PublicKey(
  'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz',
);

export const derivePDAs = (programId: PublicKey = PROGRAM_ID) => {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId,
  );

  const [rootsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('roots')],
    programId,
  );

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId,
  );

  const getVkPda = (circuitId: number) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vk'), Buffer.from([circuitId])],
      programId,
    )[0];
  };

  const getNullifiersPda = (shard: number = 0) => {
    const shardBuffer = Buffer.alloc(2);
    shardBuffer.writeUInt16LE(shard, 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('nullifiers'), shardBuffer],
      programId,
    )[0];
  };

  return {
    configPda,
    rootsPda,
    treasuryPda,
    getVkPda,
    getNullifiersPda,
  };
};

/**
 * Get explorer URL for transaction
 */
export const getExplorerUrl = (
  signature: string,
  cluster: string = 'devnet',
): string => {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
};
