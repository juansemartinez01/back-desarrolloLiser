import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateEmisorDto } from './dto/create-emisor.dto';
import { UpdateEmisorDto } from './dto/update-emisor.dto';
import { QueryEmisoresDto } from './dto/query-emisores.dto';
import { FactuExternalClient } from '../http/factu-external.client';
import { ApiLoggerService } from '../services/api-logger.service';

@Injectable()
export class EmisoresService {
  constructor(
    private readonly ds: DataSource,
    private readonly ext: FactuExternalClient,
    private readonly logger: ApiLoggerService,
  ) {}

  // --- Helpers ---------------------------------------------------------------
  private async findByIdOrThrow(id: string) {
    const rows = await this.ds.query(
      `SELECT id, cuit_computador, cuit_representado, razon_social, test, activo,
       last_success_at, last_error, last_error_at, created_at, updated_at
       FROM public.fac_emisores
       WHERE id = $1
        `,
      [id],
    );
    if (!rows?.length) throw new NotFoundException('Emisor no encontrado');
    return rows[0];
  }

  // --- CRUD ------------------------------------------------------------------

  async crear(dto: CreateEmisorDto) {
    // Unicidad por (cuit_computador, cuit_representado)
    const exists = await this.ds.query(
      `SELECT id FROM public.fac_emisores WHERE cuit_computador = $1 AND cuit_representado = $2 LIMIT 1`,
      [dto.cuit_computador, dto.cuit_representado],
    );
    if (exists?.length)
      throw new BadRequestException('Ya existe un emisor con esos CUIT');

    const [row] = await this.ds.query(
      `INSERT INTO public.fac_emisores
     (cuit_computador, cuit_representado, razon_social, cert_content, key_content, test, activo)
   VALUES ($1,$2,$3,$4,$5,$6,$7)
   RETURNING id, cuit_computador, cuit_representado, razon_social, test, activo, created_at, updated_at`,
      [
        dto.cuit_computador,
        dto.cuit_representado ?? null,
        dto.nombre_publico ?? 'SIN NOMBRE', // si querés obligarlo, hacelo required en DTO
        dto.cert_pem, // ✅ va a cert_content
        dto.key_pem, // ✅ va a key_content
        dto.test ?? true,
        dto.activo ?? true,
      ],
    );
    return { ok: true, emisor: row };


    
  }

  async actualizar(id: string, dto: UpdateEmisorDto) {
    // Traer actual para merge simple y evitar “set null” no deseado
    const current = await this.ds.query(
      `SELECT * FROM public.fac_emisores WHERE id = $1`,
      [id],
    );
    if (!current?.length) throw new NotFoundException('Emisor no encontrado');

    // Validar unicidad si cambian cuit_computador/repr
    if (dto.cuit_computador || dto.cuit_representado) {
      const cc = dto.cuit_computador ?? current[0].cuit_computador;
      const cr = dto.cuit_representado ?? current[0].cuit_representado;
      const dup = await this.ds.query(
        `SELECT id FROM public.fac_emisores WHERE cuit_computador=$1 AND cuit_representado=$2 AND id <> $3 LIMIT 1`,
        [cc, cr, id],
      );
      if (dup?.length)
        throw new BadRequestException(
          'Otro emisor ya usa esa combinación de CUIT',
        );
    }

    const merged = {
      cuit_computador: dto.cuit_computador ?? current[0].cuit_computador,
      cuit_representado: dto.cuit_representado ?? current[0].cuit_representado,

      // ✅ NOMBRES REALES DE DB
      cert_content: dto.cert_pem ?? current[0].cert_content,
      key_content: dto.key_pem ?? current[0].key_content,
      razon_social: dto.nombre_publico ?? current[0].razon_social,

      test: typeof dto.test === 'boolean' ? dto.test : current[0].test,
      activo: typeof dto.activo === 'boolean' ? dto.activo : current[0].activo,
    };


    const [row] = await this.ds.query(
      `UPDATE public.fac_emisores
   SET cuit_computador=$1,
       cuit_representado=$2,
       cert_content=$3,
       key_content=$4,
       test=$5,
       activo=$6,
       razon_social=$7,
       updated_at=now()
   WHERE id=$8
   RETURNING id, cuit_computador, cuit_representado, razon_social, test, activo, created_at, updated_at`,
      [
        merged.cuit_computador,
        merged.cuit_representado,
        merged.cert_content,
        merged.key_content,
        merged.test,
        merged.activo,
        merged.razon_social,
        id,
      ],
    );


    return { ok: true, emisor: row };
  }

  async listar(q: QueryEmisoresDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.cuit_computador) {
      conds.push(`e.cuit_computador = $${p++}`);
      params.push(q.cuit_computador);
    }
    if (q.cuit_representado) {
      conds.push(`e.cuit_representado = $${p++}`);
      params.push(q.cuit_representado);
    }
    if (typeof q.activo === 'boolean') {
      conds.push(`e.activo = $${p++}`);
      params.push(q.activo);
    }

    const where = conds.join(' AND ');

    const listSql = `
    SELECT e.id, e.cuit_computador, e.cuit_representado,
          e.razon_social AS nombre_publico,  -- ✅ alias para tu API
          e.test, e.activo,
          e.last_success_at, e.last_error, e.last_error_at, e.created_at, e.updated_at
    FROM public.fac_emisores e
    WHERE ${where}
    ORDER BY e.created_at ${order}, e.id ${order}
    LIMIT $${p++} OFFSET $${p++};
  `;

    const countSql = `SELECT COUNT(1)::int AS c FROM public.fac_emisores e WHERE ${where};`;

    const [rows, total] = await Promise.all([
      this.ds.query(listSql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  async detalle(id: string) {
    return { emisor: await this.findByIdOrThrow(id) };
  }

  async setActivo(id: string, activo: boolean) {
    const [row] = await this.ds.query(
      `UPDATE public.fac_emisores SET activo=$1, updated_at=now() WHERE id=$2
   RETURNING id, cuit_computador, cuit_representado,
             razon_social AS nombre_publico,  -- ✅
             test, activo, created_at, updated_at`,
      [activo, id],
    );

    if (!row) throw new NotFoundException('Emisor no encontrado');
    return { ok: true, emisor: row };
  }

  // --- Registrar en servicio externo (/certificados) -------------------------

  async registrarEnExterno(id: string, testOverride?: boolean) {
    // Traigo cert y key para enviar
    const rows = await this.ds.query(
      `SELECT id, cuit_computador, cuit_representado, cert_content, key_content, test, activo
   FROM public.fac_emisores WHERE id = $1`,
      [id],
    );

    if (!rows?.length) throw new NotFoundException('Emisor no encontrado');
    const e = rows[0];
    if (!e.activo) throw new BadRequestException('Emisor inactivo');

    const payload = {
      cuit_computador: Number(e.cuit_computador),
      cuit_representado: e.cuit_representado
        ? Number(e.cuit_representado)
        : null,
      cert_content: String(e.cert_content),
      key_content: String(e.key_content),
      test: typeof testOverride === 'boolean' ? testOverride : !!e.test,
    };


    try {
      // Llamada al cliente (Etapa 2)
      const resp = await this.ext.postCertificados(payload, { emisor_id: id });

      // Actualizo “última vez ok”
      await this.ds.query(
        `UPDATE public.fac_emisores SET last_success_at = now(), last_error = NULL, last_error_at = NULL, updated_at=now()
         WHERE id = $1`,
        [id],
      );

      return { ok: true, resultado: resp ?? { registrado: true } };
    } catch (err: any) {
      const msg = err?.message || 'Error registrando certificados';
      await this.ds.query(
        `UPDATE public.fac_emisores SET last_error = $1, last_error_at = now(), updated_at=now() WHERE id = $2`,
        [msg, id],
      );
      throw new BadRequestException(msg);
    }
  }
}
