import styles from './LoadingSkeleton.module.css';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'message' | 'conversation';
  count?: number;
}

export default function LoadingSkeleton({ variant = 'card', count = 1 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className={styles.cardGrid}>
        {items.map((i) => (
          <div key={i} className={styles.cardSkeleton}>
            <div className={styles.skeletonIcon} />
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonText} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'conversation') {
    return (
      <div className={styles.conversationList}>
        {items.map((i) => (
          <div key={i} className={styles.conversationSkeleton}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.conversationContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonMessage} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'message') {
    return (
      <div className={styles.messageList}>
        {items.map((i) => (
          <div key={i} className={i % 2 === 0 ? styles.messageSent : styles.messageReceived}>
            <div className={styles.skeletonMessageBubble} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={styles.listContainer}>
        {items.map((i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.skeletonLine} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
