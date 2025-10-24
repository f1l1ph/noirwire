import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NotesService } from './notes.service';

export class UploadNotesDto {
  walletAddress: string;
  encryptedData: string;
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /**
   * Upload encrypted notes for a wallet
   * POST /notes/upload
   */
  @Post('upload')
  async uploadNotes(@Body() uploadDto: UploadNotesDto) {
    try {
      await this.notesService.uploadNotes(
        uploadDto.walletAddress,
        uploadDto.encryptedData,
      );
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload notes';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Download encrypted notes for a wallet
   * GET /notes/:walletAddress
   */
  @Get(':walletAddress')
  async downloadNotes(@Param('walletAddress') walletAddress: string) {
    try {
      const encryptedData =
        await this.notesService.downloadNotes(walletAddress);
      return {
        success: true,
        encryptedData,
        found: encryptedData !== null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to download notes';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Comprehensive health check for notes sync
   * GET /notes/health
   *
   * Returns detailed status of Supabase connectivity and configuration
   */
  @Get('health')
  async healthCheck() {
    const isConfigured = this.notesService.isSupabaseConfigured();

    return {
      success: true,
      supabase: {
        configured: isConfigured,
        url: process.env.SUPABASE_URL ? 'set' : 'missing',
        serviceKey: process.env.SUPABASE_SERVICE_KEY ? 'set' : 'missing',
      },
      message: isConfigured
        ? '✅ Notes sync is fully operational'
        : '⚠️ Notes sync is not configured - set SUPABASE_URL and SUPABASE_SERVICE_KEY',
      documentation: 'See SUPABASE_VERIFICATION.md for setup instructions',
    };
  }

  /**
   * Health check for notes sync (legacy route)
   * GET /notes/health/check
   */
  @Get('health/check')
  async healthCheckLegacy() {
    return this.healthCheck();
  }
}
