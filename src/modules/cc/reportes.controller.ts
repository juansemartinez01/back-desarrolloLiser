import { Controller, Get, Query, Res } from '@nestjs/common';
import express from 'express';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';
import { ReportesService } from './reportes.service';

@Controller('cc/reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  /** CSV */
  @Get('estado-cuenta.csv')
  async estadoCuentaCsv(
    @Query() q: QueryEstadoCuentaDto,
    @Res() res: express.Response,
  ) {
    return this.service.estadoCuentaCsv(q, res);
  }

  /** XLSX */
  @Get('estado-cuenta.xlsx')
  async estadoCuentaXlsx(
    @Query() q: QueryEstadoCuentaDto,
    @Res() res: express.Response,
  ) {
    return this.service.estadoCuentaXlsx(q, res);
  }

  /** PDF (impreso) */
  @Get('estado-cuenta.pdf')
  async estadoCuentaPdf(
    @Query() q: QueryEstadoCuentaDto,
    @Res() res: express.Response,
  ) {
    return this.service.estadoCuentaPdf(q, res);
  }
}
