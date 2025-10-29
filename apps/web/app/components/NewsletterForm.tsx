'use client';

import { useState } from 'react';
import { subscribeToNewsletter } from '../actions/newsletter';
import styles from './newsletter.module.css';

interface NewsletterFormProps {
  onSuccess?: () => void;
}

export default function NewsletterForm({ onSuccess }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your email address',
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await subscribeToNewsletter(email);

      if (result.success) {
        setMessage({
          type: 'success',
          text:
            result.message ||
            'Thank you for subscribing! Check your inbox for updates.',
        });
        setEmail('');
        onSuccess?.();

        // Clear success message after 5 seconds
        setTimeout(() => {
          setMessage(null);
        }, 5000);
      } else {
        setMessage({
          type: 'error',
          text:
            result.message || 'Failed to subscribe. Please try again later.',
        });
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className={styles.input}
          required
        />
        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className={styles.button}
        >
          {isLoading ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>

      {message && (
        <div
          className={`${styles.message} ${styles[message.type]}`}
          role="alert"
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
