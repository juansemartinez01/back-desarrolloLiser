import { Module } from '@nestjs/common';
import { BackofficeLotesModule } from './lotes/backoffice-lotes.module';
import { BackofficeLotesFisicosModule } from './lotes-fisicos/backoffice-lotes-fisicos.module';

@Module({
  imports: [BackofficeLotesModule, BackofficeLotesFisicosModule],
})
export class BackofficeModule {}
