import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCcAjustes1711000001001 implements MigrationInterface {
  name = 'AddCcAjustes1711000001001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // Enum de tipo de ajuste
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cc_ajuste_tipo') THEN
          CREATE TYPE cc_ajuste_tipo AS ENUM ('NC','ND');
        END IF;
      END$$;
    `);

    // cc_ajustes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.cc_ajustes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        fecha timestamptz NOT NULL,
        cliente_id uuid NOT NULL REFERENCES public.cc_clientes(id) ON DELETE RESTRICT,
        tipo cc_ajuste_tipo NOT NULL,
        monto_total numeric(18,4) NOT NULL CHECK (monto_total > 0),
        referencia_externa varchar(100) NULL,
        observacion text NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_ajustes_fecha ON public.cc_ajustes(fecha)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_ajustes_cliente ON public.cc_ajustes(cliente_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_ajustes_tipo ON public.cc_ajustes(tipo)`,
    );
    // idempotencia si viene referencia_externa
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_cc_ajuste_ref
      ON public.cc_ajustes(cliente_id, tipo, referencia_externa)
      WHERE referencia_externa IS NOT NULL;
    `);

    // Detalle de aplicaciones de ajustes a cargos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.cc_ajustes_det (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        ajuste_id uuid NOT NULL REFERENCES public.cc_ajustes(id) ON DELETE CASCADE,
        cargo_id uuid NOT NULL REFERENCES public.cc_cargos(id) ON DELETE RESTRICT,
        importe numeric(18,4) NOT NULL CHECK (importe > 0)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_adjdet_aj ON public.cc_ajustes_det(ajuste_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_adjdet_cargo ON public.cc_ajustes_det(cargo_id)`,
    );

    // Auditoría (si existe audit.if_modified_func)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_cc_ajustes AFTER INSERT OR UPDATE OR DELETE ON public.cc_ajustes FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
          EXECUTE 'CREATE TRIGGER tr_audit_cc_ajustes_det AFTER INSERT OR UPDATE OR DELETE ON public.cc_ajustes_det FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS tr_audit_cc_ajustes ON public.cc_ajustes`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS tr_audit_cc_ajustes_det ON public.cc_ajustes_det`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS public.cc_ajustes_det`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.cc_ajustes`);
    await queryRunner.query(`DROP TYPE IF EXISTS cc_ajuste_tipo`);
  }
}
