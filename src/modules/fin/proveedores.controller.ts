import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';
import { ImportProveedoresDto } from './dto/import-proveedores.dto';

@Controller('fin/proveedores')
export class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}

  @Get()
  findAll(@Query() q: QueryProveedoresDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProveedorDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activar')
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.service.setActivo(id, true);
  }

  @Patch(':id/desactivar')
  desactivar(@Param('id', ParseIntPipe) id: number) {
    return this.service.setActivo(id, false);
  }

  // Import masivo (para que el front te mande el array ya parseado del CSV/Excel)
  @Post('import')
  importMany(@Body() dto: { proveedores: any[] }) {
    return this.service.importMany(dto.proveedores);
  }
}
