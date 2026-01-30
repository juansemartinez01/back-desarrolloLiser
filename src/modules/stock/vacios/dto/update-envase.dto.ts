import { PartialType } from '@nestjs/mapped-types';
import { CreateEnvaseDto } from './create-envase.dto';

export class UpdateEnvaseDto extends PartialType(CreateEnvaseDto) {}
