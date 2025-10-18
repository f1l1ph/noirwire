import axios from 'axios';

/**
 * Indexer Client
 * Queries the backend indexer service for Merkle proofs
 *
 * Makes HTTP requests to:
 * - GET /indexer/status
 * - POST /indexer/:circuit/proof
 * - GET /indexer/:circuit/root
 */

export interface MerkleProof {
  root: string;
  path: string[];
  pathPositions: string[];
}

type CircuitType = 'shield' | 'transfer' | 'unshield';

export interface CircuitCommitment {
  index: number;
  commitmentDecimal: string;
  commitmentHex: string;
  preview: string;
}

export interface CircuitCommitmentsResponse {
  circuit: CircuitType;
  count: number;
  commitments: CircuitCommitment[];
}

export interface SyncStatus {
  isListening: boolean;
  rpcConfigured: boolean;
  programId: string | null;
  solanaNetwork: string;
  indexerStatus: {
    initialized: boolean;
    trees: Record<string, { count: number }>;
    latestRoots: Record<string, { root: string; updatedAt: number } | null>;
  };
  rootStatus: Array<{
    root: string;
    status: 'pending' | 'published' | 'failed';
    signature?: string;
    error?: string;
    updatedAt: number;
  }>;
}

/**
 * Base URL for the indexer API
 * In development: http://localhost:3000
 * In production: https://api.noirwire.com
 */
const getIndexerBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window === 'undefined') {
    // Server-side fallback
    return 'http://localhost:3000';
  }

  // Client-side: determine API URL based on current environment
  const protocol = window.location.protocol;
  const host = window.location.host;

  // If on localhost, use localhost API
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'http://localhost:3000';
  }

  // Otherwise, use same origin
  return `${protocol}//${host}`;
};

const callIndexer = async <T>(
  method: 'GET' | 'POST',
  endpoint: string,
  data?: unknown,
): Promise<T> => {
  const baseUrl = getIndexerBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    console.debug(
      `[Indexer Client] ${method} ${url}` +
        (data ? ` payload=${JSON.stringify(data).slice(0, 200)}...` : ''),
    );
    const response = await axios.request<T>({
      url,
      method,
      data,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    });

    console.debug(
      `[Indexer Client] ${method} ${url} -> ${response.status}`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const payload =
        typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data !== undefined
            ? JSON.stringify(error.response.data)
            : error.message;

      console.error(
        `[Indexer Client] ${method} ${url} failed${status ? ` (status ${status})` : ''}`,
        {
          payload,
        },
      );

      throw new Error(
        `Indexer request failed${status ? ` (${status})` : ''}: ${payload}`,
      );
    }

    throw error;
  }
};

/**
 * Get Merkle proof for a commitment from the indexer
 *
 * @param circuit - Circuit type: 'shield' | 'transfer' | 'unshield'
 * @param commitment - The commitment hash to get proof for
 * @returns Merkle proof with root, path, and pathPositions
 *
 * @throws Error if commitment not found or indexer error
 */
export async function getMerkleProofFromIndexer(
  circuit: CircuitType,
  commitment: string,
): Promise<MerkleProof> {
  console.log(
    `[Indexer Client] Querying proof for ${circuit}: ${commitment.slice(0, 16)}...`,
  );

  try {
    const proof = await callIndexer<MerkleProof>(
      'POST',
      `/indexer/${circuit}/proof`,
      { commitment },
    );

    console.log(
      `[Indexer Client] Got proof: root=${proof.root.slice(0, 16)}..., path_length=${proof.path.length}`,
    );

    return proof;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Indexer Client] Failed to get proof: ${errorMsg}`);
    throw error;
  }
}

/**
 * Get Merkle root for a circuit
 *
 * @param circuit - Circuit type: 'shield' | 'transfer' | 'unshield'
 * @returns Root hash as hex string
 */
export async function getMerkleRootFromIndexer(
  circuit: CircuitType,
): Promise<string> {
  console.log(`[Indexer Client] Querying root for ${circuit}`);

  try {
    const { root } = await callIndexer<{ root: string }>(
      'GET',
      `/indexer/${circuit}/root`,
    );

    console.log(
      `[Indexer Client] Got root for ${circuit}: ${root.slice(0, 16)}...`,
    );

    return root;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Indexer Client] Failed to get root: ${errorMsg}`);
    throw error;
  }
}

/**
 * Add a commitment to the indexer
 *
 * @param circuit - Circuit type: 'shield' | 'transfer' | 'unshield'
 * @param commitment - The commitment hash to add (hex string)
 * @returns Success response with new root
 */
export async function addCommitmentToIndexer(
  circuit: CircuitType,
  commitment: string,
): Promise<{ success: boolean; root: string; index: number }> {
  // Validate commitment is provided
  if (!commitment || typeof commitment !== 'string') {
    throw new Error(`Invalid commitment: ${commitment}`);
  }

  console.log(
    `[Indexer Client] Adding commitment to ${circuit}: ${commitment.slice(0, 16)}...`,
  );

  try {
    const result = await callIndexer<{ success: boolean; root: string; index: number }>(
      'POST',
      `/indexer/${circuit}/commit`,
      { commitment },
    );

    // Validate response has expected fields
    if (!result || typeof result.index !== 'number' || !result.root) {
      throw new Error(
        `Invalid response from indexer: ${JSON.stringify(result)}`,
      );
    }

    console.log(
      `[Indexer Client] Commitment added: index=${result.index}, root=${result.root.slice(0, 16)}...`,
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Indexer Client] Failed to add commitment: ${errorMsg}`);
    throw error;
  }
}

/**
 * Get indexer status
 *
 * @returns Status object with initialization state and tree sizes
 */
export async function getIndexerStatus(): Promise<{
  initialized: boolean;
  trees: Record<string, { count: number }>;
}> {
  console.log(`[Indexer Client] Checking indexer status`);

  try {
    const status = await callIndexer<{
      initialized: boolean;
      trees: Record<string, { count: number }>;
    }>('GET', '/indexer/status');

    console.log(
      `[Indexer Client] Status: initialized=${status.initialized}, trees=${JSON.stringify(status.trees)}`,
    );

    return status;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Indexer Client] Failed to get status: ${errorMsg}`);
    throw error;
  }
}

/**
 * Fetch the indexed commitments for a circuit (debug endpoint).
 */
export async function getCircuitCommitmentsFromIndexer(
  circuit: CircuitType,
): Promise<CircuitCommitmentsResponse> {
  console.log(`[Indexer Client] Fetching commitments for ${circuit}`);

  try {
    return await callIndexer<CircuitCommitmentsResponse>(
      'GET',
      `/indexer/${circuit}/commitments`,
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[Indexer Client] Failed to fetch commitments: ${errorMsg}`,
    );
    throw error;
  }
}

export async function getIndexerSyncStatus(): Promise<SyncStatus> {
  try {
    return await callIndexer<SyncStatus>('GET', '/indexer/sync-status');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[Indexer Client] Failed to get sync status: ${errorMsg}`,
    );
    throw error;
  }
}

/**
 * Produce a diagnostic snapshot of the indexer state for debugging failures.
 */
export async function logIndexerDiagnostics(
  circuit: CircuitType,
  commitment?: string,
): Promise<void> {
  console.groupCollapsed(
    `[Indexer Diagnostics] ${circuit} ${commitment ? `commitment=${commitment.slice(0, 16)}...` : ''
    }`,
  );
  try {
    const status = await getIndexerStatus();
    console.info('[Indexer Diagnostics] Status:', status);

    const circuitCount = status.trees?.[circuit]?.count ?? 0;
    if (circuitCount === 0) {
      console.warn(
        `[Indexer Diagnostics] ${circuit} tree is empty (count=0).`,
      );
    } else {
      const commitments = await getCircuitCommitmentsFromIndexer(circuit);
      console.info(
        `[Indexer Diagnostics] ${circuit} commitments (first 10):`,
        commitments.commitments.slice(0, 10),
      );
    }
  } catch (diagError) {
    console.error('[Indexer Diagnostics] Failed to collect diagnostics:', diagError);
  } finally {
    console.groupEnd();
  }
}
