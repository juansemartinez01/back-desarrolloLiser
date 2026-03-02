import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MoveToNewRemitoDto {
  @IsInt()
  @IsPositive()
  proveedor_id: number;

  @IsOptional()
  @IsString()
  proveedor_nombre?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ItemsMoveDto {
  @ValidateNested()
  @Type(() => MoveToNewRemitoDto)
  to_new_remito: MoveToNewRemitoDto;

  @IsArray()
  @IsUUID('4', { each: true })
  item_ids: string[];
}
