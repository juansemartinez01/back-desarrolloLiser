import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Producto } from "./entities/producto.entity";
import { Repository } from "typeorm";
import { UpdateProductoAdminDto } from "./dto/admin-producto.dto";

@Injectable()
export class ProductosAdminService {
  constructor(
    @InjectRepository(Producto)
    private readonly repo: Repository<Producto>,
  ) {}

  private calcularConIVA(precioSin: number, iva: number) {
    return Number((precioSin * (1 + iva / 100)).toFixed(2));
  }

  private calcularSinIVA(precioCon: number, iva: number) {
    return Number((precioCon / (1 + iva / 100)).toFixed(2));
  }

  async listar(query: any) {
    const qb = this.repo.createQueryBuilder('p');

    if (query.activo !== undefined)
      qb.andWhere('p.activo = :ac', { ac: query.activo === 'true' });

    if (query.facturable !== undefined)
      qb.andWhere('p.facturable = :f', { f: query.facturable === 'true' });

    if (query.categoria_fiscal)
      qb.andWhere('p.categoria_fiscal = :cat', { cat: query.categoria_fiscal });

    if (query.search)
      qb.andWhere('p.nombre ILIKE :s OR p.codigo_comercial ILIKE :s', {
        s: `%${query.search}%`,
      });

    qb.orderBy('p.nombre', 'ASC');

    return qb.getMany();
  }

  async actualizar(id: number, dto: UpdateProductoAdminDto) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');

    let iva = dto.alicuota_iva ?? Number(p.alicuota_iva);

    // Cuando viene precio sin IVA y no precio con IVA
    if (dto.precio_sin_iva != null && dto.precio_con_iva == null) {
      dto.precio_con_iva = this.calcularConIVA(dto.precio_sin_iva, iva);
    }

    // Cuando viene precio con IVA y no precio sin IVA
    if (dto.precio_con_iva != null && dto.precio_sin_iva == null) {
      dto.precio_sin_iva = this.calcularSinIVA(dto.precio_con_iva, iva);
    }

    // Si cambia la alícuota recalculamos ambos precios
    if (dto.alicuota_iva != null) {
      if (dto.precio_sin_iva != null) {
        dto.precio_con_iva = this.calcularConIVA(
          dto.precio_sin_iva,
          dto.alicuota_iva,
        );
      } else if (dto.precio_con_iva != null) {
        dto.precio_sin_iva = this.calcularSinIVA(
          dto.precio_con_iva,
          dto.alicuota_iva,
        );
      }
    }

    Object.assign(p, dto, { updated_at: new Date() });

    return this.repo.save(p);
  }
}
