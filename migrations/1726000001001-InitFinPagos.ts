import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitFinPagos1726000001001 implements MigrationInterface {
  name = 'InitFinPagos1726000001001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_pago_estado') THEN
          CREATE TYPE fin_pago_estado AS ENUM ('REGISTRADO','ANULADO');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_pagos (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        version             int NOT NULL DEFAULT 1,

        proveedor_id        int NOT NULL,
        fecha               timestamptz NOT NULL,
        estado              fin_pago_estado NOT NULL DEFAULT 'REGISTRADO',

        monto_total         numeric(18,4) NOT NULL,
        referencia_externa  varchar(120) NULL,
        observacion         text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_pag_prov   ON fin_pagos(proveedor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_pag_fecha  ON fin_pagos(fecha)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_pag_estado ON fin_pagos(estado)`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_pag_prov_ref
      ON fin_pagos(proveedor_id, referencia_externa)
      WHERE referencia_externa IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_pago_aplic (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        version           int NOT NULL DEFAULT 1,

        pago_id           uuid NOT NULL REFERENCES fin_pagos(id) ON DELETE CASCADE,
        liquidacion_id    uuid NOT NULL REFERENCES fin_liquidaciones(id) ON DELETE RESTRICT,
        monto_aplicado    numeric(18,4) NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_papl_pag ON fin_pago_aplic(pago_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_fin_papl_liq ON fin_pago_aplic(liquidacion_id)`,
    );

    // Auditoría
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_fin_pagos      AFTER INSERT OR UPDATE OR DELETE ON fin_pagos      FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_fin_pago_aplic AFTER INSERT OR UPDATE OR DELETE ON fin_pago_aplic FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS fin_pago_aplic`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_fin_pag_prov_ref`);
    await queryRunner.query(`DROP TABLE IF EXISTS fin_pagos`);
    await queryRunner.query(`DROP TYPE IF EXISTS fin_pago_estado`);
  }
}
