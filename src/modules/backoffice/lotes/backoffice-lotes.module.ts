import { Module } from '@nestjs/common';
import { BackofficeLotesController } from './backoffice-lotes.controller';
import { BackofficeLotesService } from './backoffice-lotes.service';

@Module({
  controllers: [BackofficeLotesController],
  providers: [BackofficeLotesService],
})
export class BackofficeLotesModule {}
