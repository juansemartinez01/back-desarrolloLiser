import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatchCcSchema1711000002000 implements MigrationInterface {
  name = 'PatchCcSchema1711000002000';

  public async up(qr: QueryRunner): Promise<void> {
    // --- cc_clientes: agregar columnas si faltan ---
    await qr.query(`
      ALTER TABLE public.cc_clientes
        ADD COLUMN IF NOT EXISTS nombre_fantasia varchar(200),
        ADD COLUMN IF NOT EXISTS dni_cuit varchar(30),
        ADD COLUMN IF NOT EXISTS externo_codigo varchar(60),
        ADD COLUMN IF NOT EXISTS telefono varchar(60),
        ADD COLUMN IF NOT EXISTS email varchar(200);
    `);

    // Uniques si no existen
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ux_cc_cliente_dni'
        ) THEN
          ALTER TABLE public.cc_clientes
          ADD CONSTRAINT ux_cc_cliente_dni UNIQUE (dni_cuit);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ux_cc_cliente_ext'
        ) THEN
          ALTER TABLE public.cc_clientes
          ADD CONSTRAINT ux_cc_cliente_ext UNIQUE (externo_codigo);
        END IF;
      END
      $$;
    `);

    // Index funcional sin chocar nombre previo
    await qr.query(`
      CREATE INDEX IF NOT EXISTS ix_cc_cli_nombre_lower
      ON public.cc_clientes(LOWER(nombre));
    `);

    // --- cc_ajustes: renombrar columna a 'importe' si está 'monto_total' ---
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'cc_ajustes'
            AND column_name  = 'monto_total'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'cc_ajustes'
            AND column_name  = 'importe'
        ) THEN
          ALTER TABLE public.cc_ajustes RENAME COLUMN monto_total TO importe;
        END IF;
      END
      $$;
    `);

    // --- (opcional) renombrar valores ENUM a 'DEBITO'/'CREDITO' ---
    // Si tu Postgres >= 10, esto funciona. Si ya están renombrados, se ignora con try/catch.
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cc_ajuste_tipo') THEN
          BEGIN
            ALTER TYPE cc_ajuste_tipo RENAME VALUE 'NC' TO 'CREDITO';
          EXCEPTION WHEN others THEN
            -- ya renombrado o no existe ese valor
          END;
          BEGIN
            ALTER TYPE cc_ajuste_tipo RENAME VALUE 'ND' TO 'DEBITO';
          EXCEPTION WHEN others THEN
          END;
        END IF;
      END
      $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Down opcional: no hacemos rollback de columnas/enum por simplicidad.
  }
}
