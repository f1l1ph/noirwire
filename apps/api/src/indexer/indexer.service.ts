import { Injectable, Logger } from '@nestjs/common';
import { buildPoseidon } from 'circomlibjs';

/**
 * Merkle Proof - path and positions for inclusion proof
 */
export interface MerkleProof {
  root: string;
  path: string[];
  pathPositions: string[];
}

/**
 * IndexerService - Maintains Merkle trees for commitment inclusion proofs
 *
 * Responsibilities:
 * 1. Accept real commitments from Shield transactions via addCommitment()
 * 2. Build and maintain Merkle trees per circuit (shield/transfer/unshield)
 * 3. Generate Merkle proofs using real Poseidon hashing
 * 4. Provide efficient root lookups and inclusion proofs
 *
 * Uses circomlibjs Poseidon for proper hashing. All data is real - no test vectors.
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private poseidon: any; // Poseidon hash function from circomlibjs
  private initialized = false;
  private readonly treeDepth = 20;
  private zeroValues: string[] = [];
  private latestRoots: Record<
    string,
    { root: string; updatedAt: number } | null
  > = {
    shield: null,
    transfer: null,
    unshield: null,
  };

  // In-memory Merkle trees for each circuit
  // Key: circuit name (shield/transfer/unshield)
  // Value: array of commitments in the tree
  private trees: Record<string, string[]> = {
    shield: [],
    transfer: [],
    unshield: [],
  };

  /**
   * Initialize the indexer - must be called once on startup
   */
  async onModuleInit() {
    try {
      this.logger.log('[Indexer] Initializing Poseidon hash...');
      this.poseidon = await buildPoseidon();
      this.initializeZeroValues();
      this.initialized = true;
      this.logger.log('[Indexer] Poseidon initialized successfully');
      this.logger.log(
        '[Indexer] Trees are empty - ready to receive real commitments from blockchain or API',
      );
    } catch (error) {
      this.logger.error(`[Indexer] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Add a commitment to a circuit's tree
   * In production, called when Shield transaction is confirmed on-chain
   * Returns the index where it was added and the new root
   *
   * @param commitment - Can be hex string (with or without 0x) or decimal string
   */
  public async addCommitment(
    circuit: 'shield' | 'transfer' | 'unshield',
    commitment: string,
  ): Promise<{ index: number; root: string }> {
    if (!this.initialized) {
      throw new Error('Indexer not initialized');
    }

     const treeKey = this.resolveTreeKey(circuit);

    // Normalize commitment to decimal string for internal storage
    // This is needed because Poseidon.F.toString() returns decimal strings
    let normalizedCommitment: string;
    try {
      // If it looks like a hex string (only contains [0-9a-fA-F]), convert to decimal
      if (/^[0-9a-fA-F]+$/.test(commitment)) {
        // Hex string without 0x prefix
        const bigIntValue = BigInt('0x' + commitment);
        normalizedCommitment = bigIntValue.toString(10); // Convert to decimal
        this.logger.debug(
          `[Indexer] Converted hex commitment to decimal: ${commitment.slice(0, 16)}... -> ${normalizedCommitment}`,
        );
      } else if (commitment.startsWith('0x')) {
        // Hex string with 0x prefix
        const bigIntValue = BigInt(commitment);
        normalizedCommitment = bigIntValue.toString(10);
        this.logger.debug(
          `[Indexer] Converted hex commitment to decimal: ${commitment.slice(0, 16)}... -> ${normalizedCommitment}`,
        );
      } else {
        // Already decimal string
        normalizedCommitment = commitment;
      }
    } catch (error) {
      throw new Error(`Cannot convert ${commitment} to a BigInt: ${error}`);
    }

    // Add commitment and get its index
    const index = this.trees[treeKey].length;
    this.trees[treeKey].push(normalizedCommitment);

    this.logger.log(
      `[Indexer] Added commitment to ${treeKey} tree from ${circuit} at index ${index}: ${normalizedCommitment.slice(0, 16)}...`,
    );
    this.logger.debug(
      `[Indexer] ${treeKey} tree size is now ${this.trees[treeKey].length}`,
    );
    if (this.trees[treeKey].length <= 5) {
      const preview = this.trees[treeKey].map((value, idx) => ({
        index: idx,
        decimal: value,
        hex: this.decimalToHex(value),
      }));
      this.logger.debug(
        `[Indexer] Current ${treeKey} commitments: ${JSON.stringify(preview)}`,
      );
    }

    // Calculate new root
    const root = await this.getRoot(treeKey);
    this.latestRoots[treeKey] = {
      root,
      updatedAt: Date.now(),
    };

    return { index, root };
  }

  /**
   * Pre-compute zero values for each tree level so padding hashes stay deterministic.
   */
  private initializeZeroValues() {
    this.zeroValues = new Array(this.treeDepth + 1);
    this.zeroValues[0] = '0';

    for (let level = 1; level <= this.treeDepth; level++) {
      const previous = this.zeroValues[level - 1];
      this.zeroValues[level] = this.hashPair(previous, previous);
    }

    this.logger.log(
      `[Indexer] Precomputed zero values for ${this.treeDepth} levels`,
    );
  }

  /**
   * Get Merkle proof for a commitment
   * Returns root, path, and positions for circuit verification
   *
   * @param commitment - Can be hex string (with or without 0x) or decimal string
   */
  public async getProof(
    circuit: 'shield' | 'transfer' | 'unshield',
    commitment: string,
  ): Promise<MerkleProof> {
    this.logger.debug('=== GET MERKLE PROOF START ===');
    this.logger.debug(`Circuit: ${circuit}`);
    this.logger.debug(`Commitment: ${commitment}`);

    if (!this.initialized) {
      throw new Error('Indexer not initialized');
    }

    const treeKey = this.resolveTreeKey(circuit);
    const commitments = this.trees[treeKey];
    this.logger.debug(`Tree has ${commitments?.length || 0} commitments`);

    if (!commitments || commitments.length === 0) {
      this.logger.error(`❌ No commitments found for circuit: ${treeKey}`);
      this.logger.error('Tree is empty! Did you forget to shield first?');
      this.logger.error('Available circuits:', Object.keys(this.trees));
      const treeSizes = Object.entries(this.trees).reduce(
        (acc, [key, val]) => ({ ...acc, [key]: val.length }),
        {},
      );
      this.logger.error('Tree sizes:', JSON.stringify(treeSizes));
      throw new Error(`No commitments found for circuit: ${treeKey}`);
    }

    // Normalize commitment to decimal for searching (same as storage format)
    let normalizedCommitment: string;
    try {
      if (/^[0-9a-fA-F]+$/.test(commitment)) {
        // Hex without 0x
        normalizedCommitment = BigInt('0x' + commitment).toString(10);
        this.logger.debug(
          `Normalized hex (no 0x) to decimal: ${normalizedCommitment}`,
        );
      } else if (commitment.startsWith('0x')) {
        // Hex with 0x
        normalizedCommitment = BigInt(commitment).toString(10);
        this.logger.debug(
          `Normalized hex (with 0x) to decimal: ${normalizedCommitment}`,
        );
      } else {
        // Already decimal
        normalizedCommitment = commitment;
        this.logger.debug(`Already decimal: ${normalizedCommitment}`);
      }
    } catch (err) {
      this.logger.error(`❌ Invalid commitment format: ${commitment}`);
      this.logger.error(`Error: ${err}`);
      throw new Error(`Invalid commitment format: ${commitment}`);
    }

    // Find commitment index (compare as decimal strings)
    this.logger.debug(`Searching for commitment in tree...`);
    this.logger.debug(
      `Tree commitments: ${JSON.stringify(commitments.slice(0, 5))}${commitments.length > 5 ? '...' : ''}`,
    );
    const index = commitments.findIndex((c) => c === normalizedCommitment);

    if (index === -1) {
      this.logger.error(`❌ Commitment not found in ${circuit} tree`);
      this.logger.error(`Searched for: ${normalizedCommitment}`);
      this.logger.error(`Tree has ${commitments.length} commitments:`);
      commitments.slice(0, 10).forEach((c, i) => {
        const hexValue = this.decimalToHex(c);
        this.logger.error(
          `  [${i}]: dec=${c.slice(0, 16)}... hex=${hexValue.slice(0, 16)}...`,
        );
      });
      throw new Error(
        `Commitment not found in ${circuit} tree. ` +
          `Searched for: ${normalizedCommitment.slice(0, 16)}... ` +
          `Tree has ${commitments.length} commitments.`,
      );
    }

    this.logger.log(`✅ Found commitment at index ${index}`);
    this.logger.debug('=== GET MERKLE PROOF END ===');

    // Generate Merkle proof
    return this.generateProof(commitments, index);
  }

  /**
   * Generate Merkle proof for a commitment at given index
   *
   * Algorithm:
   * 1. Start at leaf, traverse to root
   * 2. At each level, collect sibling hash
   * 3. Record whether sibling is left (0) or right (1)
   */
  private generateProof(commitments: string[], leafIndex: number): MerkleProof {
    const pathValues: string[] = [];
    const pathPositions: string[] = [];

    // Build tree level by level
    let currentLevel = [...commitments];
    let currentIndex = leafIndex;

    this.logger.log(
      `[Indexer] Building proof for leaf at index ${leafIndex} (level has ${currentLevel.length} nodes)`,
    );

    for (let level = 0; level < this.treeDepth; level++) {
      if (currentLevel.length === 0) {
        pathValues.push(this.zeroValues[level]);
        pathPositions.push('0');
        currentLevel = [this.zeroValues[level + 1]];
        currentIndex = Math.floor(currentIndex / 2);
        continue;
      }

      if (currentLevel.length % 2 === 1) {
        currentLevel = [...currentLevel, this.zeroValues[level]];
      }

      // Find sibling at current level
      const isLeftChild = currentIndex % 2 === 0;
      const siblingIndex = isLeftChild ? currentIndex + 1 : currentIndex - 1;

      const sibling =
        siblingIndex >= 0 && siblingIndex < currentLevel.length
          ? currentLevel[siblingIndex]
          : this.zeroValues[level];

      pathValues.push(sibling);
      pathPositions.push(isLeftChild ? '0' : '1');

      // Move to next level (hash pairs)
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right =
          i + 1 < currentLevel.length ? currentLevel[i + 1] : this.zeroValues[level];

        // Hash this pair
        const hash = this.hashPair(left, right);
        nextLevel.push(hash);
      }

      currentLevel = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);

      this.logger.debug(
        `[Indexer] Level ${level}: sibling=${this.decimalToHex(sibling).slice(0, 8)}..., hash_count=${nextLevel.length}`,
      );
    }

    // Final hash is the root
    const root = currentLevel[0] || this.zeroValues[this.treeDepth];
    const rootHex = this.decimalToHex(root);

    this.logger.log(
      `[Indexer] Generated proof with root: ${rootHex.slice(0, 16)}...`,
    );

    return {
      root: rootHex,
      path: pathValues.map((value) => this.decimalToHex(value)),
      pathPositions,
    };
  }

  /**
   * Hash two values using Poseidon
   * Poseidon([left, right]) = hash of the pair
   *
   * @param left - Decimal string representation of field element
   * @param right - Decimal string representation of field element
   * @returns Decimal string representation of hash result
   */
  private hashPair(left: string, right: string): string {
    if (!this.poseidon) {
      throw new Error('Poseidon not initialized');
    }

    try {
      // Convert decimal strings to BigInt (all internal values are decimal)
      const leftBig = BigInt(left);
      const rightBig = BigInt(right);

      // Use Poseidon hash function
      const hash = this.poseidon([leftBig, rightBig]);

      // Convert back to decimal string
      return this.poseidon.F.toString(hash);
    } catch (error) {
      this.logger.error(
        `[Indexer] Poseidon hash failed: ${error}, left=${left.slice(0, 8)}..., right=${right.slice(0, 8)}...`,
      );
      throw error;
    }
  }

  /**
   * Compute the root of a tree for the given commitment set (decimal strings).
   */
  private computeRootDecimal(commitments: string[]): string {
    let currentLevel = [...commitments];

    for (let level = 0; level < this.treeDepth; level++) {
      if (currentLevel.length === 0) {
        return this.zeroValues[this.treeDepth];
      }

      if (currentLevel.length % 2 === 1) {
        currentLevel = [...currentLevel, this.zeroValues[level]];
      }

      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        nextLevel.push(this.hashPair(left, right));
      }

      currentLevel = nextLevel;
    }

    return currentLevel[0] ?? this.zeroValues[this.treeDepth];
  }

  /**
   * Convert decimal string representation from Poseidon back into fixed-length hex.
   */
  private decimalToHex(value: string): string {
    const hex = BigInt(value).toString(16);
    const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
    return padded.padStart(64, '0');
  }

  /**
   * Get root of tree for a circuit
   * Used to validate against on-chain roots
   */
  public async getRoot(
    circuit: 'shield' | 'transfer' | 'unshield',
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Indexer not initialized');
    }

    const treeKey = this.resolveTreeKey(circuit);
    const commitments = this.trees[treeKey];
    if (!commitments || commitments.length === 0) {
      throw new Error(`No commitments found for circuit: ${treeKey}`);
    }

    const rootDecimal = this.computeRootDecimal(commitments);
    return this.decimalToHex(rootDecimal);
  }

  /**
   * Get status/stats about the indexer
   */
  public getStatus() {
    const shieldCount = this.trees.shield.length;
    return {
      initialized: this.initialized,
      trees: {
        shield: {
          count: shieldCount,
        },
        transfer: {
          count: shieldCount,
        },
        unshield: {
          count: this.trees.unshield?.length || 0,
        },
      },
      latestRoots: {
        shield: this.latestRoots.shield,
        transfer: this.latestRoots.transfer,
        unshield: this.latestRoots.unshield,
      },
    };
  }

  /**
   * Get all commitments in a tree (for debugging)
   */
  public getCommitments(circuit: 'shield' | 'transfer' | 'unshield') {
    const treeKey = this.resolveTreeKey(circuit);
    const commitments = this.trees[treeKey] || [];
    return {
      circuit: treeKey,
      count: commitments.length,
      commitments: commitments.map((c, index) => ({
        index,
        commitmentDecimal: c,
        commitmentHex: this.decimalToHex(c),
        // Show first 16 chars for readability
        preview: this.decimalToHex(c).slice(0, 16) + '...',
      })),
    };
  }

  private resolveTreeKey(
    circuit: 'shield' | 'transfer' | 'unshield',
  ): 'shield' | 'transfer' | 'unshield' {
    if (circuit === 'transfer') {
      return 'shield';
    }
    return circuit;
  }
}
