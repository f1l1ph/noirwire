'use client';

import { useState } from 'react';
import styles from './debug.module.css';
import {
  addCommitmentToIndexer as addCommitmentRequest,
  getCircuitCommitmentsFromIndexer,
  getIndexerStatus as fetchIndexerStatus,
  getMerkleProofFromIndexer as fetchMerkleProof,
} from '../../lib/indexerClient';

/**
 * Debug Indexer Page
 * 
 * This page helps debug Merkle tree / indexer issues by:
 * 1. Showing indexer status
 * 2. Manually adding commitments
 * 3. Testing Merkle proof generation
 * 4. Showing all notes in localStorage
 */
export default function DebugIndexerPage() {
  const [status, setStatus] = useState<{
    initialized: boolean;
    trees: Record<string, { count: number }>;
    latestRoots?: Record<string, { root: string; updatedAt: number } | null>;
    shieldCommitments?: Array<{
      index: number;
      commitmentDecimal: string;
      commitmentHex: string;
      preview: string;
    }>;
  } | null>(null);
  const [testCommitment, setTestCommitment] = useState('');
  const [testCircuit, setTestCircuit] = useState<'shield' | 'transfer' | 'unshield'>('shield');
  const [proofResult, setProofResult] = useState<{
    root: string;
    path: string[];
    pathPositions: string[];
  } | null>(null);
  const [addResult, setAddResult] = useState<{
    success: boolean;
    root: string;
    index: number;
  } | null>(null);
  const [notes, setNotes] = useState<Array<{ wallet: string; notes: unknown[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadIndexerStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchIndexerStatus();
      let nextStatus = data;

      // Also fetch commitments for shield tree
      if (data.trees.shield.count > 0) {
        const commitmentsData =
          await getCircuitCommitmentsFromIndexer('shield');
        console.log('[Debug] Shield commitments:', commitmentsData);
        nextStatus = {
          ...data,
          shieldCommitments: commitmentsData.commitments,
        };
      }

      setStatus(nextStatus);
      console.log('[Debug] Indexer status:', nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('[Debug] Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = () => {
    try {
      const allNotes: Array<{ wallet: string; notes: unknown[] }> = [];
      
      // Find all noirwire_notes_* keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('noirwire_notes_')) {
          const wallet = key.replace('noirwire_notes_', '');
          const notesJson = localStorage.getItem(key);
          if (notesJson) {
            const parsed = JSON.parse(notesJson);
            allNotes.push({
              wallet: wallet.slice(0, 8) + '...',
              notes: parsed,
            });
          }
        }
      }
      
      setNotes(allNotes);
      console.log('[Debug] Loaded notes from localStorage:', allNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('[Debug] Failed to load notes:', err);
    }
  };

  const handleAddCommitment = async () => {
    if (!testCommitment) {
      setError('Please enter a commitment');
      return;
    }

    setLoading(true);
    setError('');
    setAddResult(null);

    try {
      console.log(`[Debug] Adding commitment to ${testCircuit}:`, testCommitment);
      
      const result = await addCommitmentRequest(testCircuit, testCommitment);
      setAddResult(result);
      console.log('[Debug] Commitment added:', result);

      // Refresh status
      await loadIndexerStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('[Debug] Failed to add commitment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestMerkleProof = async () => {
    if (!testCommitment) {
      setError('Please enter a commitment');
      return;
    }

    setLoading(true);
    setError('');
    setProofResult(null);

    try {
      console.log(`[Debug] Getting proof for ${testCircuit}:`, testCommitment);
      
      const result = await fetchMerkleProof(testCircuit, testCommitment);
      setProofResult(result);
      console.log('[Debug] Merkle proof:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('[Debug] Failed to get proof:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🔍 Indexer Debug Page</h1>
      
      {error && (
        <div className={styles.error}>
          <span className={styles.errorTitle}>❌ Error:</span> {error}
        </div>
      )}

      {/* Section 1: Indexer Status */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Indexer Status</h2>
        <button 
          onClick={loadIndexerStatus} 
          disabled={loading}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {loading ? 'Loading...' : 'Load Status'}
        </button>

        {status && (
          <pre className={styles.codeBlock}>
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </section>

      {/* Section 2: LocalStorage Notes */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Notes in LocalStorage</h2>
        <button 
          onClick={loadNotes}
          className={`${styles.button} ${styles.buttonSecondary}`}
        >
          Load Notes
        </button>

        {notes.length > 0 && (
          <div className={styles.notesContainer}>
            {notes.map((walletNotes, idx) => (
              <div key={idx} className={styles.walletNotes}>
                <div className={styles.walletTitle}>Wallet: {walletNotes.wallet}</div>
                <pre className={styles.codeBlock}>
                  {JSON.stringify(walletNotes.notes, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Manual Testing */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Manual Test</h2>
        
        <div className={styles.inputGroup}>
          <label className={styles.label}>
            Circuit:
            <select 
              value={testCircuit} 
              onChange={(e) => setTestCircuit(e.target.value as 'shield' | 'transfer' | 'unshield')}
              className={styles.select}
            >
              <option value="shield">Shield</option>
              <option value="transfer">Transfer</option>
              <option value="unshield">Unshield</option>
            </select>
          </label>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>
            Commitment (hex or decimal):
          </label>
          <input
            type="text"
            value={testCommitment}
            onChange={(e) => setTestCommitment(e.target.value)}
            placeholder="0x1234... or 1234567890..."
            className={styles.input}
          />
        </div>

        <div className={styles.buttonRow}>
          <button 
            onClick={handleAddCommitment}
            disabled={loading || !testCommitment}
            className={`${styles.button} ${styles.buttonWarning}`}
          >
            Add to Indexer
          </button>

          <button 
            onClick={handleTestMerkleProof}
            disabled={loading || !testCommitment}
            className={`${styles.button} ${styles.buttonPurple}`}
          >
            Get Merkle Proof
          </button>
        </div>

        {addResult && (
          <div className={styles.resultSection}>
            <h3 className={styles.resultTitle}>✅ Add Result:</h3>
            <pre className={styles.codeBlock}>
              {JSON.stringify(addResult, null, 2)}
            </pre>
          </div>
        )}

        {proofResult && (
          <div className={styles.resultSection}>
            <h3 className={styles.resultTitle}>✅ Proof Result:</h3>
            <pre className={styles.codeBlock}>
              {JSON.stringify(proofResult, null, 2)}
            </pre>
            <div className={`${styles.proofStatus} ${
              proofResult.path.length === 20 
                ? styles.proofStatusSuccess 
                : styles.proofStatusError
            }`}>
              {proofResult.path.length === 20 
                ? `✅ Path has correct length (20)` 
                : `❌ Path has wrong length (${proofResult.path.length}, expected 20)`}
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Quick Actions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Quick Actions</h2>
        <p className={styles.helpText}>
          Click &quot;Load Notes&quot; above, then copy a commitment from your notes and use it to test.
        </p>
        <div className={styles.workflow}>
          <div className={styles.workflowTitle}>Workflow:</div>
          1. Load Status → Check tree counts<br />
          2. Load Notes → Find a commitment<br />
          3. Paste commitment → Add to Indexer<br />
          4. Get Merkle Proof → Verify path has 20 elements
        </div>
      </section>
    </div>
  );
}
