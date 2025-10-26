'use client';

import { useWalletData } from '../context/WalletDataContext';
import styles from './SyncStatusIndicator.module.css';

export default function SyncStatusIndicator() {
  const { isSyncing, syncError, clearSyncError } = useWalletData();

  // Don't show anything if everything is fine
  if (!isSyncing && !syncError) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Loading state */}
      {isSyncing && (
        <div className={styles.syncingContainer}>
          <div className={styles.spinner}></div>
          <span className={styles.syncingText}>Syncing notes to Supabase...</span>
        </div>
      )}

      {/* Error state */}
      {syncError && !isSyncing && (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorContent}>
            <div className={styles.errorTitle}>Supabase Sync Failed</div>
            <div className={styles.errorMessage}>{syncError}</div>
            <div className={styles.errorHelp}>
              Check that SUPABASE_URL and SUPABASE_SERVICE_KEY are set on your API server.
              See SUPABASE_VERIFICATION.md for help.
            </div>
          </div>
          <button
            className={styles.dismissButton}
            onClick={clearSyncError}
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
