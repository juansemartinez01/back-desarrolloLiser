import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BackofficeLotesService } from './backoffice-lotes.service';
import {
  CreateBackofficeLoteDto,
  FacturarBackofficeDto,
  QueryBackofficeLotesDto,
  QueryBackofficeProductosPendientesDto,
  SeleccionarBackofficeDto,
  UpdateBackofficeLoteDto,
} from './dto/backoffice-lotes.dto';

@Controller('backoffice/lotes')
export class BackofficeLotesController {
  constructor(private readonly service: BackofficeLotesService) {}

  @Get()
  listar(@Query() q: QueryBackofficeLotesDto) {
    return this.service.listar(q);
  }

  @Get('productos')
  productosPendientes(@Query() q: QueryBackofficeProductosPendientesDto) {
    return this.service.productosPendientes(q);
  }

  @Get(':id')
  obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtener(id);
  }

  @Post()
  crear(@Body() dto: CreateBackofficeLoteDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBackofficeLoteDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Post('facturar')
  facturar(@Body() dto: FacturarBackofficeDto) {
    return this.service.registrarFacturacion(dto.producto_id, dto.cantidad);
  }

  @Post('seleccionar')
  seleccionar(@Body() dto: SeleccionarBackofficeDto) {
    return this.service.seleccionarProductos(dto);
  }

  @Delete(':id')
  borrar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.borrar(id);
  }
}
