/**
 * Wallet Controller - Simple endpoints for balance and transaction management
 */

import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WalletService } from './wallet.service';
import type { Note } from './wallet.service';

@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * Get user's private balance
   * POST because we need password (shouldn't be in URL)
   */
  @Post('balance')
  async getBalance(
    @Body('publicKey') publicKey: string,
    @Body('password') password: string,
  ) {
    try {
      const balance = await this.walletService.getPrivateBalance(
        publicKey,
        password,
      );

      return {
        success: true,
        balance,
      };
    } catch (error: any) {
      this.logger.error('Failed to get balance:', error.message);
      return {
        success: false,
        error: error.message,
        balance: {
          total: '0',
          spendable: '0',
          pending: '0',
          notes: [],
        },
      };
    }
  }

  /**
   * Add a new note (called after shield operation)
   */
  @Post('add-note')
  async addNote(
    @Body('publicKey') publicKey: string,
    @Body('password') password: string,
    @Body('note') note: Omit<Note, 'id' | 'createdAt'>,
  ) {
    try {
      await this.walletService.addNote(publicKey, password, note);

      return {
        success: true,
        message: 'Note added successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to add note:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark note as spent (called after transfer/unshield)
   */
  @Post('spend-note')
  async spendNote(
    @Body('publicKey') publicKey: string,
    @Body('password') password: string,
    @Body('noteId') noteId: string,
    @Body('nullifier') nullifier: string,
  ) {
    try {
      await this.walletService.spendNote(
        publicKey,
        password,
        noteId,
        nullifier,
      );

      return {
        success: true,
        message: 'Note marked as spent',
      };
    } catch (error: any) {
      this.logger.error('Failed to spend note:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Select optimal notes for a transaction
   */
  @Post('select-notes')
  async selectNotes(
    @Body('publicKey') publicKey: string,
    @Body('password') password: string,
    @Body('amount') amount: string,
  ) {
    try {
      const notes = await this.walletService.selectNotesForAmount(
        publicKey,
        password,
        amount,
      );

      return {
        success: true,
        notes,
      };
    } catch (error: any) {
      this.logger.error('Failed to select notes:', error.message);
      return {
        success: false,
        error: error.message,
        notes: [],
      };
    }
  }
}
