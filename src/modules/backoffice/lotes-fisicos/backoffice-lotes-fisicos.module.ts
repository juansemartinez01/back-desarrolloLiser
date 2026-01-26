import { Module } from '@nestjs/common';
import { BackofficeLotesFisicosController } from './backoffice-lotes-fisicos.controller';
import { BackofficeLotesFisicosService } from './backoffice-lotes-fisicos.service';

@Module({
  controllers: [BackofficeLotesFisicosController],
  providers: [BackofficeLotesFisicosService],
})
export class BackofficeLotesFisicosModule {}
