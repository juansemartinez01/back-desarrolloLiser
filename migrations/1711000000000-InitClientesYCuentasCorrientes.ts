import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitClientesYCuentasCorrientes1711000000000
  implements MigrationInterface
{
  name = 'InitClientesYCuentasCorrientes1711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // Enums
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cc_pago_cuenta') THEN
          CREATE TYPE cc_pago_cuenta AS ENUM ('CUENTA1','CUENTA2');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cc_ajuste_tipo') THEN
          CREATE TYPE cc_ajuste_tipo AS ENUM ('DEBITO','CREDITO');
        END IF;
      END$$;
    `);

    // CLIENTES locales
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_clientes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        nombre varchar(200) NOT NULL,            -- razón social / nombre
        nombre_fantasia varchar(200) NULL,
        dni_cuit varchar(30) NULL,               -- único si se usa
        externo_codigo varchar(60) NULL,         -- código en sistema externo
        telefono varchar(60) NULL,
        email varchar(200) NULL,
        activo boolean NOT NULL DEFAULT true,

        CONSTRAINT ux_cc_cliente_dni UNIQUE (dni_cuit),
        CONSTRAINT ux_cc_cliente_ext UNIQUE (externo_codigo)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cli_nombre ON cc_clientes(LOWER(nombre))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cli_activo ON cc_clientes(activo)`,
    );

    // CARGOS (deuda por venta)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_cargos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        fecha timestamptz NOT NULL,
        fecha_vencimiento timestamptz NULL,
        cliente_id uuid NOT NULL REFERENCES cc_clientes(id) ON DELETE RESTRICT,
        venta_ref_tipo varchar(30) NOT NULL DEFAULT 'VENTA',
        venta_ref_id varchar(100) NOT NULL,
        importe numeric(18,4) NOT NULL CHECK (importe > 0),
        observacion text NULL,

        CONSTRAINT ux_cc_cargo_ref UNIQUE (cliente_id, venta_ref_tipo, venta_ref_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cargos_cli_fecha ON cc_cargos(cliente_id, fecha)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cargos_venc ON cc_cargos(fecha_vencimiento)`,
    );

    // PAGOS (encabezado)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_pagos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        fecha timestamptz NOT NULL,
        cliente_id uuid NOT NULL REFERENCES cc_clientes(id) ON DELETE RESTRICT,
        cuenta cc_pago_cuenta NOT NULL,
        importe numeric(18,4) NOT NULL CHECK (importe > 0),
        referencia_externa varchar(100) NULL,
        observacion text NULL,

        CONSTRAINT ux_cc_pago_ref UNIQUE (cliente_id, referencia_externa)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_pagos_cli_fecha ON cc_pagos(cliente_id, fecha)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_pagos_cuenta ON cc_pagos(cuenta)`,
    );

    // DETALLE de aplicación de pagos a cargos (trazabilidad fina)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_pagos_det (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        pago_id uuid NOT NULL REFERENCES cc_pagos(id) ON DELETE CASCADE,
        cargo_id uuid NOT NULL REFERENCES cc_cargos(id) ON DELETE RESTRICT,
        importe numeric(18,4) NOT NULL CHECK (importe > 0),

        CONSTRAINT ux_cc_pdet_pago_cargo UNIQUE (pago_id, cargo_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_pdet_pago ON cc_pagos_det(pago_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_pdet_cargo ON cc_pagos_det(cargo_id)`,
    );

    // AJUSTES (manuales): DEBITO = suma deuda, CREDITO = resta deuda (equivalente a nota de crédito)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_ajustes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        fecha timestamptz NOT NULL,
        cliente_id uuid NOT NULL REFERENCES cc_clientes(id) ON DELETE RESTRICT,
        tipo cc_ajuste_tipo NOT NULL,
        importe numeric(18,4) NOT NULL CHECK (importe > 0),
        referencia_externa varchar(100) NULL,
        observacion text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_ajustes_cli_fecha ON cc_ajustes(cliente_id, fecha)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_ajustes_tipo ON cc_ajustes(tipo)`,
    );

    // Auditoría (si existe)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_cc_clientes   AFTER INSERT OR UPDATE OR DELETE ON cc_clientes   FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_cc_cargos     AFTER INSERT OR UPDATE OR DELETE ON cc_cargos     FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_cc_pagos      AFTER INSERT OR UPDATE OR DELETE ON cc_pagos      FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_cc_pagos_det  AFTER INSERT OR UPDATE OR DELETE ON cc_pagos_det  FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_cc_ajustes    AFTER INSERT OR UPDATE OR DELETE ON cc_ajustes    FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cc_ajustes`);
    await queryRunner.query(`DROP TABLE IF EXISTS cc_pagos_det`);
    await queryRunner.query(`DROP TABLE IF EXISTS cc_pagos`);
    await queryRunner.query(`DROP TABLE IF EXISTS cc_cargos`);
    await queryRunner.query(`DROP TABLE IF EXISTS cc_clientes`);
    await queryRunner.query(`DROP TYPE IF EXISTS cc_ajuste_tipo`);
    await queryRunner.query(`DROP TYPE IF EXISTS cc_pago_cuenta`);
  }
}
