import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitStock1710000000000 implements MigrationInterface {
  name = 'InitStock1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`SET search_path TO public`);
    
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(
      `CREATE TYPE stk_movimiento_tipo AS ENUM ('INGRESO','TRANSFERENCIA','VENTA','MERMA','AJUSTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE stk_lote_color AS ENUM ('BLANCO','NEGRO')`,
    );
    await queryRunner.query(
      `CREATE TYPE stk_empresa_factura AS ENUM ('GLADIER','SAYRUS')`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_remitos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        fecha_remito timestamptz NOT NULL,
        numero_remito varchar(80) NOT NULL,
        proveedor_id int NULL,
        proveedor_nombre varchar(200) NULL,
        observaciones text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_remitos_fecha ON stk_remitos(fecha_remito)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_remitos_numero ON stk_remitos(numero_remito)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_remitos_proveedor ON stk_remitos(proveedor_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_remito_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        remito_id uuid NOT NULL REFERENCES stk_remitos(id) ON DELETE RESTRICT,
        producto_id int NOT NULL,
        unidad varchar(50) NULL,
        cantidad_total numeric(18,4) NOT NULL,
        cantidad_blanco numeric(18,4) NOT NULL,
        cantidad_negro numeric(18,4) NOT NULL,
        empresa_factura stk_empresa_factura NOT NULL,
        CONSTRAINT chk_ri_sum CHECK ((cantidad_blanco + cantidad_negro) = cantidad_total)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_ri_remito ON stk_remito_items(remito_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_ri_prod ON stk_remito_items(producto_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_lotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        remito_item_id uuid NOT NULL REFERENCES stk_remito_items(id) ON DELETE RESTRICT,
        producto_id int NOT NULL,
        fecha_remito timestamptz NOT NULL,
        color stk_lote_color NOT NULL,
        cantidad_inicial numeric(18,4) NOT NULL,
        cantidad_disponible numeric(18,4) NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_lotes_prod ON stk_lotes(producto_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_lotes_fecha ON stk_lotes(fecha_remito)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_lotes_color ON stk_lotes(color)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_lotes_remito_item ON stk_lotes(remito_item_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_lote_almacen (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        lote_id uuid NOT NULL REFERENCES stk_lotes(id) ON DELETE CASCADE,
        almacen_id int NOT NULL,
        cantidad_asignada numeric(18,4) NOT NULL DEFAULT 0,
        cantidad_disponible numeric(18,4) NOT NULL DEFAULT 0,
        CONSTRAINT ux_lote_almacen UNIQUE (lote_id, almacen_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_la_lote ON stk_lote_almacen(lote_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_la_alm ON stk_lote_almacen(almacen_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_movimientos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        tipo stk_movimiento_tipo NOT NULL,
        fecha timestamptz NOT NULL DEFAULT now(),
        almacen_origen_id int NULL,
        almacen_destino_id int NULL,
        referencia_tipo varchar(50) NULL,
        referencia_id varchar(100) NULL,
        observacion text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_mov_tipo ON stk_movimientos(tipo)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_mov_fecha ON stk_movimientos(fecha)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_movimientos_det (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        movimiento_id uuid NOT NULL REFERENCES stk_movimientos(id) ON DELETE CASCADE,
        producto_id int NOT NULL,
        lote_id uuid NULL REFERENCES stk_lotes(id) ON DELETE SET NULL,
        cantidad numeric(18,4) NOT NULL,
        efecto smallint NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_mdet_mov ON stk_movimientos_det(movimiento_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_mdet_prod ON stk_movimientos_det(producto_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_mdet_lote ON stk_movimientos_det(lote_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_stock_actual (
        id serial PRIMARY KEY,
        producto_id int NOT NULL,
        almacen_id int NOT NULL,
        cantidad numeric(18,4) NOT NULL DEFAULT 0,
        CONSTRAINT ux_stock_actual_prod_alm UNIQUE (producto_id, almacen_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_sa_prod ON stk_stock_actual(producto_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_sa_alm ON stk_stock_actual(almacen_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stk_consumos_pendientes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        fecha timestamptz NOT NULL DEFAULT now(),
        producto_id int NOT NULL,
        cantidad_pendiente numeric(18,4) NOT NULL,
        referencia_venta_id varchar(100) NULL,
        precio_unitario numeric(18,4) NULL,
        notas text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_stk_pend_prod_fecha ON stk_consumos_pendientes(producto_id, fecha)`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_stk_remitos             AFTER INSERT OR UPDATE OR DELETE ON stk_remitos             FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_remito_items        AFTER INSERT OR UPDATE OR DELETE ON stk_remito_items        FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_lotes               AFTER INSERT OR UPDATE OR DELETE ON stk_lotes               FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_lote_almacen        AFTER INSERT OR UPDATE OR DELETE ON stk_lote_almacen        FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_movimientos         AFTER INSERT OR UPDATE OR DELETE ON stk_movimientos         FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_movimientos_det     AFTER INSERT OR UPDATE OR DELETE ON stk_movimientos_det     FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_stock_actual        AFTER INSERT OR UPDATE OR DELETE ON stk_stock_actual        FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_stk_consumos_pendientes AFTER INSERT OR UPDATE OR DELETE ON stk_consumos_pendientes FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stk_consumos_pendientes`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_stock_actual`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_movimientos_det`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_movimientos`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_lote_almacen`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_lotes`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_remito_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stk_remitos`);
    await queryRunner.query(`DROP TYPE IF EXISTS stk_empresa_factura`);
    await queryRunner.query(`DROP TYPE IF EXISTS stk_lote_color`);
    await queryRunner.query(`DROP TYPE IF EXISTS stk_movimiento_tipo`);
  }
}
