import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SubscribeNewsletterDto {
  email!: string;
  ipAddress?: string;
  userAgent?: string;
}

export class UnsubscribeNewsletterDto {
  token!: string;
}

interface SubscribeResult {
  success: boolean;
  message: string;
  email_address: string;
}

interface UnsubscribeResult {
  success: boolean;
  message: string;
}

interface NewsletterStatsResult {
  total_subscribers: number;
  active_subscribers: number;
  unsubscribed: number;
}

@Injectable()
export class NewsletterService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Validates email format and basic checks
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Email is required');
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length > 254) {
      throw new BadRequestException('Email is too long');
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Check for common disposable email domains (basic check)
    const disposableDomains = [
      'tempmail.com',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
    ];
    const domain = trimmedEmail.split('@')[1];
    if (disposableDomains.includes(domain)) {
      throw new BadRequestException(
        'Disposable email addresses are not allowed',
      );
    }
  }

  /**
   * Subscribe an email to the newsletter
   */
  async subscribeToNewsletter(
    dto: SubscribeNewsletterDto,
  ): Promise<{ success: boolean; message: string; email: string }> {
    // Validate email
    this.validateEmail(dto.email);

    if (!this.supabaseService.isConfigured()) {
      throw new BadRequestException('Database not configured');
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Database connection failed');
    }

    try {
      const trimmedEmail = dto.email.trim().toLowerCase();

      // Call the subscribe_newsletter SQL function
      const { data, error } = await client
        .rpc('subscribe_newsletter', {
          p_email: trimmedEmail,
          p_ip_address: dto.ipAddress || null,
          p_user_agent: dto.userAgent || null,
        })
        .single();

      if (error) {
        // Check if it's a unique constraint violation (already subscribed)
        if (error.message.includes('duplicate') || error.code === '23505') {
          throw new ConflictException('This email is already subscribed');
        }
        throw new BadRequestException(error.message);
      }

      const result = data as SubscribeResult;
      return {
        success: result.success,
        message: result.message,
        email: result.email_address,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Newsletter subscription error:', error);
      throw new BadRequestException(
        'Failed to subscribe. Please try again later.',
      );
    }
  }

  /**
   * Unsubscribe from newsletter using token
   */
  async unsubscribeFromNewsletter(
    dto: UnsubscribeNewsletterDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!dto.token || typeof dto.token !== 'string') {
      throw new BadRequestException('Invalid unsubscribe token');
    }

    if (!this.supabaseService.isConfigured()) {
      throw new BadRequestException('Database not configured');
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Database connection failed');
    }

    try {
      const { data, error } = await client
        .rpc('unsubscribe_newsletter', {
          p_token: dto.token.trim(),
        })
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }

      const result = data as UnsubscribeResult;
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Newsletter unsubscribe error:', error);
      throw new BadRequestException(
        'Failed to unsubscribe. Please try again later.',
      );
    }
  }

  /**
   * Get newsletter statistics (admin only in production)
   */
  async getNewsletterStats(): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
    unsubscribed: number;
  }> {
    if (!this.supabaseService.isConfigured()) {
      throw new BadRequestException('Database not configured');
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Database connection failed');
    }

    try {
      const { data, error } = await client.rpc('get_newsletter_stats').single();

      if (error) {
        throw new BadRequestException(error.message);
      }

      const result = data as NewsletterStatsResult;
      return {
        totalSubscribers: Number(result.total_subscribers),
        activeSubscribers: Number(result.active_subscribers),
        unsubscribed: Number(result.unsubscribed),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Newsletter stats error:', error);
      throw new BadRequestException('Failed to fetch newsletter statistics.');
    }
  }

  /**
   * Check if Supabase is configured
   */
  isSupabaseConfigured(): boolean {
    return this.supabaseService.isConfigured();
  }
}
