import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';
import { EstadoCuentaService } from './estado-cuenta.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function safeName(s?: string) {
  return (s || '').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80);
}
function fmtDec(n: number | string, d = 4) {
  const v = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(v) ? v.toFixed(d) : '0.0000';
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly ds: DataSource,
    private readonly estadoSvc: EstadoCuentaService,
  ) {}

  private async getClienteMeta(cliente_id: string) {
    // Ajustá campos a tu tabla cc_clientes
    const r = await this.ds.query(
      `SELECT id, nombre, codigo_externo, dni
       FROM public.cc_clientes
       WHERE id = $1`,
      [cliente_id],
    );
    return (
      r?.[0] ?? {
        id: cliente_id,
        nombre: 'CLIENTE',
        codigo_externo: null,
        dni: null,
      }
    );
  }

  /** CSV */
  async estadoCuentaCsv(q: QueryEstadoCuentaDto, res: Response) {
    const data = await this.estadoSvc.estadoCuenta(q);
    const cli = await this.getClienteMeta(q.cliente_id);

    const filename = `estado_cuenta_${safeName(cli.nombre)}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // BOM para Excel en Windows
    res.write('\uFEFF');

    const header = [
      'Cliente',
      'Desde',
      'Hasta',
      'SaldoInicial',
      'SaldoFinal',
      'Fecha',
      'Tipo',
      'OrigenId',
      'Referencia',
      'Observacion',
      'Importe',
      'SaldoCorrido',
    ];
    res.write(header.join(',') + '\n');

    for (const m of data.movimientos) {
      const row = [
        `"${(cli.nombre || '').replace(/"/g, '""')}"`,
        data.rango.desde ?? '',
        data.rango.hasta ?? '',
        fmtDec(data.saldo_inicial, 2),
        fmtDec(data.saldo_final, 2),
        m.fecha,
        m.tipo,
        m.origen_id,
        `"${(m.referencia || '').replace(/"/g, '""')}"`,
        `"${(m.observacion || '').replace(/"/g, '""')}"`,
        fmtDec(m.importe, 2),
        fmtDec(m.saldo_corrido, 2),
      ];
      res.write(row.join(',') + '\n');
    }
    res.end();
  }

  /** XLSX */
  async estadoCuentaXlsx(q: QueryEstadoCuentaDto, res: Response) {
    const data = await this.estadoSvc.estadoCuenta(q);
    const cli = await this.getClienteMeta(q.cliente_id);

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const ws = wb.addWorksheet('Estado de Cuenta');

    // Encabezado
    ws.mergeCells('A1', 'F1');
    ws.getCell('A1').value = `Estado de Cuenta - ${cli.nombre}`;
    ws.getCell('A1').font = { bold: true, size: 14 };

    ws.getCell('A2').value = 'Desde';
    ws.getCell('B2').value = data.rango.desde ?? '-';
    ws.getCell('A3').value = 'Hasta';
    ws.getCell('B3').value = data.rango.hasta ?? '-';
    ws.getCell('D2').value = 'Saldo Inicial';
    ws.getCell('E2').value = Number(fmtDec(data.saldo_inicial, 2));
    ws.getCell('D3').value = 'Saldo Final';
    ws.getCell('E3').value = Number(fmtDec(data.saldo_final, 2));

    // Tabla
    ws.addRow([]);
    const headerRow = ws.addRow([
      'Fecha',
      'Tipo',
      'OrigenId',
      'Referencia',
      'Observación',
      'Importe',
      'Saldo',
    ]);
    headerRow.font = { bold: true };
    ws.columns = [
      { width: 20 },
      { width: 12 },
      { width: 36 },
      { width: 28 },
      { width: 40 },
      { width: 14 },
      { width: 14 },
    ];

    for (const m of data.movimientos) {
      ws.addRow([
        m.fecha,
        m.tipo,
        m.origen_id,
        m.referencia ?? '',
        m.observacion ?? '',
        Number(fmtDec(m.importe, 2)),
        Number(fmtDec(m.saldo_corrido, 2)),
      ]);
    }

    // Totales del período
    ws.addRow([]);
    ws.addRow(['', '', '', 'Totales período:']);
    ws.addRow([
      '',
      '',
      '',
      'Cargos',
      Number(fmtDec(data.totales_periodo.total_cargos, 2)),
    ]);
    ws.addRow([
      '',
      '',
      '',
      'ND',
      Number(fmtDec(data.totales_periodo.total_nd, 2)),
    ]);
    ws.addRow([
      '',
      '',
      '',
      'Pagos C1',
      Number(fmtDec(data.totales_periodo.total_pagos_c1, 2)),
    ]);
    ws.addRow([
      '',
      '',
      '',
      'Pagos C2',
      Number(fmtDec(data.totales_periodo.total_pagos_c2, 2)),
    ]);
    ws.addRow([
      '',
      '',
      '',
      'NC',
      Number(fmtDec(data.totales_periodo.total_nc, 2)),
    ]);
    ws.addRow([
      '',
      '',
      '',
      'Neto',
      Number(fmtDec(data.totales_periodo.neto_periodo, 2)),
    ]);

    const filename = `estado_cuenta_${safeName(cli.nombre)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  }

  /** PDF */
  async estadoCuentaPdf(q: QueryEstadoCuentaDto, res: Response) {
    const data = await this.estadoSvc.estadoCuenta(q);
    const cli = await this.getClienteMeta(q.cliente_id);

    const filename = `estado_cuenta_${safeName(cli.nombre)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    // Header
    doc.fontSize(14).text(`Estado de Cuenta`, { align: 'left' }).moveDown(0.2);
    doc
      .fontSize(10)
      .text(`Cliente: ${cli.nombre}`, { continued: true })
      .text(`   ID: ${cli.id}`);
    if (cli.codigo_externo) doc.text(`Código externo: ${cli.codigo_externo}`);
    if (cli.dni) doc.text(`DNI: ${cli.dni}`);
    doc.text(`Rango: ${data.rango.desde ?? '-'} a ${data.rango.hasta ?? '-'}`);
    doc.text(
      `Saldo inicial: ${fmtDec(data.saldo_inicial, 2)}   |   Saldo final: ${fmtDec(data.saldo_final, 2)}`,
    );
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    // Table header
    doc.moveDown(0.4);
    const startY = doc.y;
    const cols = [
      { k: 'fecha', label: 'Fecha', w: 100 },
      { k: 'tipo', label: 'Tipo', w: 70 },
      { k: 'origen_id', label: 'Origen', w: 120 },
      { k: 'referencia', label: 'Ref', w: 100 },
      { k: 'importe', label: 'Importe', w: 75, align: 'right' as const },
      { k: 'saldo_corrido', label: 'Saldo', w: 75, align: 'right' as const },
    ];
    let x = 40;
    doc.font('Helvetica-Bold').fontSize(9);
    for (const c of cols) {
      doc.text(c.label, x, startY, { width: c.w, align: c.align ?? 'left' });
      x += c.w + 5;
    }
    doc.font('Helvetica').moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    // Rows
    doc.fontSize(9);
    let y = doc.y + 4;
    for (const m of data.movimientos) {
      x = 40;
      const row = {
        fecha: m.fecha,
        tipo: m.tipo,
        origen_id: m.origen_id,
        referencia: m.referencia ?? '',
        importe: fmtDec(m.importe, 2),
        saldo_corrido: fmtDec(m.saldo_corrido, 2),
      };
      const rowHeight = 14;

      // Auto page-break
      if (y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }

      for (const c of cols) {
        doc.text(String((row as any)[c.k]), x, y, {
          width: c.w,
          align: c.align ?? 'left',
        });
        x += c.w + 5;
      }
      y += rowHeight;
    }

    // Totales box
    if (y + 100 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    doc.moveTo(320, y).lineTo(555, y).stroke();
    y += 6;
    const lines = [
      ['Cargos', fmtDec(data.totales_periodo.total_cargos, 2)],
      ['ND', fmtDec(data.totales_periodo.total_nd, 2)],
      ['Pagos C1', fmtDec(data.totales_periodo.total_pagos_c1, 2)],
      ['Pagos C2', fmtDec(data.totales_periodo.total_pagos_c2, 2)],
      ['NC', fmtDec(data.totales_periodo.total_nc, 2)],
      ['Neto período', fmtDec(data.totales_periodo.neto_periodo, 2)],
      ['Saldo inicial', fmtDec(data.saldo_inicial, 2)],
      ['Saldo final', fmtDec(data.saldo_final, 2)],
    ];
    for (const [k, v] of lines) {
      doc.text(k, 325, y, { width: 120, align: 'left' });
      doc.text(v, 455, y, { width: 95, align: 'right' });
      y += 14;
    }

    // Footer
    doc.moveDown(1);
    doc
      .fontSize(8)
      .text(
        `Generado: ${new Date().toLocaleString()} | Sistema CORE`,
        40,
        doc.page.height - 40,
        { align: 'left' },
      );

    doc.end();
  }
}
