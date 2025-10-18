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
   * Health check for notes sync
   * GET /notes/health
   */
  @Get('health/check')
  async healthCheck() {
    const isConfigured = this.notesService.isSupabaseConfigured();
    return {
      success: true,
      configured: isConfigured,
      message: isConfigured
        ? 'Notes sync is available'
        : 'Notes sync is not configured',
    };
  }
}
