import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ProductosAdminService } from "./productos-admin.service";
import { UpdateProductoAdminDto } from "./dto/admin-producto.dto";

@Controller('productos/admin')
export class ProductosAdminController {
  constructor(private readonly service: ProductosAdminService) {}

  @Get()
  listar(@Query() q: any) {
    return this.service.listar(q);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoAdminDto,
  ) {
    return this.service.actualizar(id, dto);
  }
}
