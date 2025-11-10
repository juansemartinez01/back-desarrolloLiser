import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinProveedoresInt1720001000000
  implements MigrationInterface
{
  name = 'CreateFinProveedoresInt1720001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabla fin_proveedores
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fin_proveedores (
        id int PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        nombre varchar(200) NOT NULL,
        cuit varchar(20),
        activo boolean NOT NULL DEFAULT true,
        external_ref varchar(100)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_fin_prov_activo ON fin_proveedores(activo);
    `);

    // Trigger de auditoría si está disponible
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_fin_proveedores
                   AFTER INSERT OR UPDATE OR DELETE ON fin_proveedores
                   FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END
      $$;
    `);

    // --- FKs opcionales a tablas existentes ---

    // 1) stock.remitos.proveedor_id -> fin_proveedores.id (int)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='stk_remitos' AND column_name='proveedor_id'
        ) THEN
          -- asegurar tipo int
          BEGIN
            ALTER TABLE public.stk_remitos
            ALTER COLUMN proveedor_id TYPE int USING proveedor_id::int;
          EXCEPTION WHEN others THEN
            -- si ya es int, seguimos
          END;

          -- agregar FK si no existe
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='stk_remitos' AND constraint_name='fk_stk_remitos_proveedor'
          ) THEN
            ALTER TABLE public.stk_remitos
            ADD CONSTRAINT fk_stk_remitos_proveedor
            FOREIGN KEY (proveedor_id) REFERENCES public.fin_proveedores(id) ON DELETE RESTRICT;
          END IF;
        END IF;
      END
      $$;
    `);

    // 2) fin_pagos.proveedor_id -> fin_proveedores.id (int)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='fin_pagos' AND column_name='proveedor_id'
        ) THEN
          BEGIN
            ALTER TABLE public.fin_pagos
            ALTER COLUMN proveedor_id TYPE int USING proveedor_id::int;
          EXCEPTION WHEN others THEN
          END;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='fin_pagos' AND constraint_name='fk_fin_pagos_proveedor'
          ) THEN
            ALTER TABLE public.fin_pagos
            ADD CONSTRAINT fk_fin_pagos_proveedor
            FOREIGN KEY (proveedor_id) REFERENCES public.fin_proveedores(id) ON DELETE RESTRICT;
          END IF;
        END IF;
      END
      $$;
    `);

    // 3) fin_liquidaciones.proveedor_id -> fin_proveedores.id (int)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='fin_liquidaciones' AND column_name='proveedor_id'
        ) THEN
          BEGIN
            ALTER TABLE public.fin_liquidaciones
            ALTER COLUMN proveedor_id TYPE int USING proveedor_id::int;
          EXCEPTION WHEN others THEN
          END;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='fin_liquidaciones' AND constraint_name='fk_fin_liq_proveedor'
          ) THEN
            ALTER TABLE public.fin_liquidaciones
            ADD CONSTRAINT fk_fin_liq_proveedor
            FOREIGN KEY (proveedor_id) REFERENCES public.fin_proveedores(id) ON DELETE RESTRICT;
          END IF;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Quitar FKs (si existen)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_schema='public' AND table_name='stk_remitos' AND constraint_name='fk_stk_remitos_proveedor')
        THEN
          ALTER TABLE public.stk_remitos DROP CONSTRAINT fk_stk_remitos_proveedor;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_schema='public' AND table_name='fin_pagos' AND constraint_name='fk_fin_pagos_proveedor')
        THEN
          ALTER TABLE public.fin_pagos DROP CONSTRAINT fk_fin_pagos_proveedor;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_schema='public' AND table_name='fin_liquidaciones' AND constraint_name='fk_fin_liq_proveedor')
        THEN
          ALTER TABLE public.fin_liquidaciones DROP CONSTRAINT fk_fin_liq_proveedor;
        END IF;
      END
      $$;
    `);

    // Borrar tabla
    await queryRunner.query(`DROP TABLE IF EXISTS fin_proveedores;`);
  }
}
