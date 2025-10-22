import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProofService } from './proof.service';
import { VerifierService } from '../verifier/verifier.service';

@Controller('proof')
export class ProofController {
  private readonly logger = new Logger(ProofController.name);

  constructor(
    private readonly proofService: ProofService,
    private readonly verifierService: VerifierService,
  ) {}

  @Post('generate')
  async generate(
    @Body()
    body: {
      circuit: 'shield' | 'transfer' | 'unshield';
      input: Record<string, any>;
    },
  ) {
    const { circuit, input } = body;
    const requestId = Math.random().toString(36).substr(2, 9);

    this.logger.log(`[${requestId}] Generate proof request for circuit: ${circuit}`);

    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      this.logger.warn(`[${requestId}] Invalid circuit: ${circuit}`);
      throw new BadRequestException(
        `Invalid circuit: ${circuit}. Must be shield, transfer, or unshield`,
      );
    }

    // Validate input
    if (!input || typeof input !== 'object') {
      this.logger.warn(`[${requestId}] Invalid or missing input object`);
      throw new BadRequestException('Input must be a valid object');
    }

    try {
      this.logger.log(`[${requestId}] Starting proof generation for ${circuit}...`);
      const startTime = Date.now();

      // Generate proof
      const result = await this.proofService.generateProof(circuit, input);
      const proofGenTime = Date.now() - startTime;

      this.logger.log(
        `[${requestId}] Proof generated successfully for ${circuit} (${proofGenTime}ms)`,
      );

      // Verify proof automatically
      this.logger.log(`[${requestId}] Verifying generated ${circuit} proof...`);
      const verifyStartTime = Date.now();

      const verification = await this.verifierService.verifyProof(circuit, {
        proof: result.proofBase64,
        publicSignals: result.publicSignals,
      });

      const verifyTime = Date.now() - verifyStartTime;

      if (!verification.valid) {
        this.logger.error(
          `[${requestId}] Generated proof failed verification: ${verification.error}`,
        );
        throw new InternalServerErrorException(
          `Generated proof failed verification: ${verification.error}`,
        );
      }

      this.logger.log(
        `[${requestId}] ✅ Proof verified successfully (gen: ${proofGenTime}ms, verify: ${verifyTime}ms)`,
      );

      return {
        ...result,
        verified: true,
        verificationTime: verification.timing?.verificationMs,
        generationTime: proofGenTime,
        requestId,
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const errorType = error?.name || 'unknown';

      this.logger.error(
        `[${requestId}] Proof generation failed for ${circuit}: ${errorMsg}`,
      );
      this.logger.error(`[${requestId}] Error type: ${errorType}`);

      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // Check for specific error types
      if (errorMsg.includes('Circuit artifacts missing')) {
        throw new InternalServerErrorException(
          `Circuit artifacts not found for ${circuit}. The deployment might be missing the proofs folder.`,
        );
      }

      if (errorMsg.includes('WASM')) {
        throw new InternalServerErrorException(
          `WASM loading failed for ${circuit}: ${errorMsg}`,
        );
      }

      if (errorMsg.includes('path_elements') || errorMsg.includes('path_index')) {
        throw new BadRequestException(
          `Invalid proof input: missing or invalid path_elements/path_index. ${errorMsg}`,
        );
      }

      // Generic error handler
      throw new InternalServerErrorException(
        `Proof generation failed: ${errorMsg}`,
      );
    }
  }

  @Post('verify')
  async verify(
    @Body()
    body: {
      circuit: 'shield' | 'transfer' | 'unshield';
      proof: string;
      publicSignals: string[];
    },
  ) {
    const { circuit, proof, publicSignals } = body;
    const requestId = Math.random().toString(36).substr(2, 9);

    this.logger.log(`[${requestId}] Verify proof request for circuit: ${circuit}`);

    // Validate circuit
    if (!['shield', 'transfer', 'unshield'].includes(circuit)) {
      this.logger.warn(`[${requestId}] Invalid circuit: ${circuit}`);
      throw new BadRequestException(
        `Invalid circuit: ${circuit}. Must be shield, transfer, or unshield`,
      );
    }

    // Validate proof and signals
    if (!proof || typeof proof !== 'string') {
      throw new BadRequestException('Proof must be a base64 string');
    }

    if (!Array.isArray(publicSignals)) {
      throw new BadRequestException('Public signals must be an array');
    }

    try {
      this.logger.log(`[${requestId}] Starting verification for ${circuit}...`);
      const startTime = Date.now();

      const result = await this.verifierService.verifyProof(circuit, {
        proof,
        publicSignals,
      });

      const verifyTime = Date.now() - startTime;
      this.logger.log(
        `[${requestId}] Verification completed (${verifyTime}ms) - valid: ${result.valid}`,
      );

      return {
        valid: result.valid,
        error: result.error,
        timing: result.timing,
        requestId,
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      this.logger.error(
        `[${requestId}] Verification failed for ${circuit}: ${errorMsg}`,
      );

      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // For verification, return error but still return 200 with valid: false
      return {
        valid: false,
        error: errorMsg,
        requestId,
      };
    }
  }
}
