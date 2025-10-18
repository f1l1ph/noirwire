import { Controller, Post, Body, Logger } from '@nestjs/common';
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

    try {
      // Generate proof
      const result = await this.proofService.generateProof(circuit, input);

      // Verify proof automatically
      this.logger.log(`Verifying generated ${circuit} proof...`);
      const verification = await this.verifierService.verifyProof(circuit, {
        proof: result.proofBase64,
        publicSignals: result.publicSignals,
      });

      if (!verification.valid) {
        this.logger.error(
          `Generated proof failed verification: ${verification.error}`,
        );
        throw new Error('Generated proof failed verification');
      }

      this.logger.log(
        `✅ Proof verified successfully (${verification.timing?.verificationMs}ms)`,
      );

      return {
        ...result,
        verified: true,
        verificationTime: verification.timing?.verificationMs,
      };
    } catch (error: any) {
      this.logger.error(`Proof generation failed: ${error.message}`);
      throw error;
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

    try {
      const result = await this.verifierService.verifyProof(circuit, {
        proof,
        publicSignals,
      });

      return {
        valid: result.valid,
        error: result.error,
        timing: result.timing,
      };
    } catch (error: any) {
      this.logger.error(`Verification failed: ${error.message}`);
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}
