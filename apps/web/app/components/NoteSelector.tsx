'use client';

import { useState, useEffect } from 'react';
import { Note } from '../../lib/types';
import { getUnspentNotes } from '../../lib/notes';
import styles from './NoteSelector.module.css';

interface NoteSelectorProps {
  walletAddress: string;
  onSelect: (note: Note) => void;
  selectedNote?: Note;
}

export function NoteSelector({ walletAddress, onSelect, selectedNote }: NoteSelectorProps) {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (walletAddress) {
      const unspent = getUnspentNotes(walletAddress);
      setNotes(unspent);
    }
  }, [walletAddress]);

  if (notes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          📭 No unspent notes found. Shield some SOL first!
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <label className={styles.label}>Select note to spend:</label>
      <div className={styles.noteList}>
        {notes.map((note) => (
          <button
            key={note.commitment}
            onClick={() => onSelect(note)}
            className={`${styles.noteCard} ${selectedNote?.commitment === note.commitment ? styles.noteCardSelected : ''}`}
          >
            <div className={styles.noteHeader}>
              <span className={styles.noteAmount}>{parseFloat(note.amount).toFixed(4)} SOL</span>
              <span className={styles.noteDate}>
                {new Date(note.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.noteCommitment}>
              Commitment: {note.commitment.slice(0, 16)}...{note.commitment.slice(-16)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
