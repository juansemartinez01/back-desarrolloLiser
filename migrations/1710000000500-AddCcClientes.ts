// migrations/1710000000500-AddCcClientes.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCcClientes1710000000500 implements MigrationInterface {
  name = 'AddCcClientes1710000000500';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS public.cc_clientes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,

        -- datos básicos (ajusta a gusto)
        nombre varchar(200) NOT NULL,
        documento varchar(30) NULL,
        codigo_externo varchar(50) NULL,
        activo boolean NOT NULL DEFAULT true
      );
    `);

    await qr.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cli_nombre ON public.cc_clientes(nombre)`,
    );
    await qr.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cli_documento ON public.cc_clientes(documento)`,
    );
    await qr.query(
      `CREATE INDEX IF NOT EXISTS ix_cc_cli_activo ON public.cc_clientes(activo)`,
    );

    // Triggers de auditoría si usás audit.if_modified_func()
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'if_modified_func' AND n.nspname = 'audit'
        ) THEN
          EXECUTE 'CREATE TRIGGER tr_audit_cc_clientes AFTER INSERT OR UPDATE OR DELETE ON public.cc_clientes FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func()';
        END IF;
      END
      $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS public.cc_clientes`);
  }
}
