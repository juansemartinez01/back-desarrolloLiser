import { Module } from '@nestjs/common';
import { BackofficeLotesModule } from './lotes/backoffice-lotes.module';
import { BackofficeLotesFisicosModule } from './lotes-fisicos/backoffice-lotes-fisicos.module';
import { BackofficeCcModule } from './cc/backoffice-cc.module';

@Module({
  imports: [
    BackofficeLotesModule,
    BackofficeLotesFisicosModule,
    BackofficeCcModule,
  ],
})
export class BackofficeModule {}
