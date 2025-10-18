import { Module } from '@nestjs/common';
import { VerifierService } from './verifier.service';

@Module({
  providers: [VerifierService],
  exports: [VerifierService],
})
export class VerifierModule {}
