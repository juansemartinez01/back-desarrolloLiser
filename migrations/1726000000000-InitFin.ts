import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitFin1726000000000 implements MigrationInterface {
  name = 'InitFin1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // Enums
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_liq_estado') THEN
          CREATE TYPE fin_liq_estado AS ENUM ('BORRADOR','CONFIRMADA','ANULADA');
        END IF;
      END $$;
    `);

    // Proveedores (snapshot local, opcional)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_proveedores (
        id            int PRIMARY KEY,            -- mismo id que el sistema externo si querés
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        version       int NOT NULL DEFAULT 1,
        nombre        varchar(200) NOT NULL,
        cuit          varchar(20) NULL,
        activo        boolean NOT NULL DEFAULT true,
        external_ref  varchar(100) NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_prov_activo ON fin_proveedores(activo)`,
    );

    // Liquidaciones (cabecera)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_liquidaciones (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        version              int NOT NULL DEFAULT 1,
        proveedor_id         int NOT NULL,
        fecha                timestamptz NOT NULL,
        estado               fin_liq_estado NOT NULL DEFAULT 'BORRADOR',
        total_monto          numeric(18,4) NOT NULL DEFAULT 0,
        referencia_externa   varchar(120) NULL,  -- si el negocio usa nro interno/recibo
        observacion          text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_liq_prov   ON fin_liquidaciones(proveedor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_liq_estado ON fin_liquidaciones(estado)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_liq_fecha  ON fin_liquidaciones(fecha)`,
    );
    // Única por proveedor + ref externa (si te sirve para idempotencia)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_liq_prov_ref ON fin_liquidaciones(proveedor_id, referencia_externa)
      WHERE referencia_externa IS NOT NULL;
    `);

    // Liquidaciones (detalle) — trazado contra remito (y opcional ítem)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_liquidacion_det (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at         timestamptz NOT NULL DEFAULT now(),
        updated_at         timestamptz NOT NULL DEFAULT now(),
        version            int NOT NULL DEFAULT 1,
        liquidacion_id     uuid NOT NULL REFERENCES fin_liquidaciones(id) ON DELETE CASCADE,
        remito_id          uuid NOT NULL,
        remito_item_id     uuid NULL,
        producto_id        int NOT NULL,
        cantidad_base      numeric(18,4) NOT NULL DEFAULT 0,    -- cantidad vendida usada como base (para control)
        monto_pago         numeric(18,4) NOT NULL,              -- importe que se paga (lo ingresa el operador)
        notas              text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_ld_liq ON fin_liquidacion_det(liquidacion_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_ld_rem ON fin_liquidacion_det(remito_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_ld_rit ON fin_liquidacion_det(remito_item_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_ld_prod ON fin_liquidacion_det(producto_id)`,
    );

    // Triggers de auditoría (si existe audit.if_modified_func)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_fin_proveedores     AFTER INSERT OR UPDATE OR DELETE ON fin_proveedores     FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_fin_liquidaciones   AFTER INSERT OR UPDATE OR DELETE ON fin_liquidaciones   FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_fin_liquidacion_det AFTER INSERT OR UPDATE OR DELETE ON fin_liquidacion_det FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS fin_liquidacion_det`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_fin_liq_prov_ref`);
    await queryRunner.query(`DROP TABLE IF EXISTS fin_liquidaciones`);
    await queryRunner.query(`DROP TABLE IF EXISTS fin_proveedores`);
    await queryRunner.query(`DROP TYPE IF EXISTS fin_liq_estado`);
  }
}
