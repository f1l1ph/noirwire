import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LinksModule } from './links/links.module';
import { NotesModule } from './notes/notes.module';
import { VerifierModule } from './verifier/verifier.module';
import { WalletModule } from './wallet/wallet.module';
import { IndexerModule } from './indexer/indexer.module';
import { NewsletterModule } from './newsletter/newsletter.module';

import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ProofController } from './proof/proof.controller';
import { ProofService } from './proof/proof.service';
import { VerifierService } from './verifier/verifier.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LinksModule,
    NotesModule,
    VerifierModule,
    WalletModule,
    IndexerModule,
    NewsletterModule,
  ],
  controllers: [AppController, ProofController],
  providers: [AppService, ProofService, VerifierService],
})
export class AppModule {}
