import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  NewsletterService,
  SubscribeNewsletterDto,
  UnsubscribeNewsletterDto,
} from './newsletter.service';
import { Request } from 'express';

@Controller('api/newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  /**
   * Subscribe to newsletter
   * POST /api/newsletter/subscribe
   */
  @Post('subscribe')
  async subscribe(@Body() dto: SubscribeNewsletterDto, @Req() req: Request) {
    try {
      // Add client info if not provided
      if (!dto.ipAddress) {
        dto.ipAddress =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
          req.socket.remoteAddress ||
          'unknown';
      }

      if (!dto.userAgent) {
        dto.userAgent = req.headers['user-agent'] || 'unknown';
      }

      const result = await this.newsletterService.subscribeToNewsletter(dto);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Re-throw HTTP exceptions
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Newsletter subscribe endpoint error:', error);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to subscribe to newsletter',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Unsubscribe from newsletter
   * POST /api/newsletter/unsubscribe
   */
  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeNewsletterDto) {
    try {
      const result =
        await this.newsletterService.unsubscribeFromNewsletter(dto);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Re-throw HTTP exceptions
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Newsletter unsubscribe endpoint error:', error);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to unsubscribe from newsletter',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get newsletter statistics
   * GET /api/newsletter/stats
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.newsletterService.getNewsletterStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      // Re-throw HTTP exceptions
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Newsletter stats endpoint error:', error);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch newsletter statistics',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check
   * GET /api/newsletter/health
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      supabaseConfigured: this.newsletterService.isSupabaseConfigured(),
    };
  }
}
