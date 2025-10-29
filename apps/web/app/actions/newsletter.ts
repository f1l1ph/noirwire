'use server';

import { headers } from 'next/headers';

export interface NewsletterSubscribeResponse {
  success: boolean;
  message: string;
  email?: string;
}

/**
 * Server Action to subscribe to the newsletter
 * This runs on the server, so the email is never exposed to the client
 * and we have access to server headers for security
 */
export async function subscribeToNewsletter(
  email: string,
): Promise<NewsletterSubscribeResponse> {
  try {
    // Validate email on server-side
    if (!email || typeof email !== 'string') {
      return {
        success: false,
        message: 'Email is required',
      };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return {
        success: false,
        message: 'Please enter a valid email address',
      };
    }

    if (trimmedEmail.length > 254) {
      return {
        success: false,
        message: 'Email address is too long',
      };
    }

    // Get headers for additional security info
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || 'unknown';
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Call the API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Forwarded-For': ipAddress,
      },
      body: JSON.stringify({
        email: trimmedEmail,
        ipAddress,
        userAgent,
      }),
      // Important: Don't cache this response
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.message ||
        errorData?.data?.message ||
        'Failed to subscribe to newsletter';

      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        message: data.data.message || 'Successfully subscribed to newsletter!',
        email: data.data.email,
      };
    }

    return {
      success: false,
      message: 'Failed to subscribe. Please try again.',
    };
  } catch (error) {
    console.error('Newsletter subscription error:', error);

    return {
      success: false,
      message: 'An error occurred. Please try again later.',
    };
  }
}

/**
 * Server Action to unsubscribe from the newsletter
 */
export async function unsubscribeFromNewsletter(
  token: string,
): Promise<NewsletterSubscribeResponse> {
  try {
    if (!token || typeof token !== 'string') {
      return {
        success: false,
        message: 'Invalid unsubscribe link',
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/newsletter/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token.trim(),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        message: 'Failed to unsubscribe',
      };
    }

    const data = await response.json();

    return {
      success: data.success,
      message: data.data?.message || 'Successfully unsubscribed',
    };
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);

    return {
      success: false,
      message: 'An error occurred. Please try again later.',
    };
  }
}
