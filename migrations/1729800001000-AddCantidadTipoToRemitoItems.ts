// 1729800001000-AddCantidadTipoToRemitoItems.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCantidadTipoToRemitoItems1729800001000
  implements MigrationInterface
{
  name = 'AddCantidadTipoToRemitoItems1729800001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Agregar columnas nuevas con default 0 para no romper inserts
    await queryRunner.query(`
      ALTER TABLE public.stk_remito_items
      ADD COLUMN IF NOT EXISTS cantidad_tipo1 numeric(18,4) DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS cantidad_tipo2 numeric(18,4) DEFAULT 0 NOT NULL
    `);

    // 2) Si existen columnas viejas, migrar datos (blanco->tipo1, negro->tipo2)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='stk_remito_items' AND column_name='cantidad_blanco'
        ) THEN
          EXECUTE 'UPDATE public.stk_remito_items SET cantidad_tipo1 = COALESCE(cantidad_blanco,0)';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='stk_remito_items' AND column_name='cantidad_negro'
        ) THEN
          EXECUTE 'UPDATE public.stk_remito_items SET cantidad_tipo2 = COALESCE(cantidad_negro,0)';
        END IF;
      END $$;
    `);

    // 3) Opcional: quitar DEFAULT para obligar a enviar valores en el futuro
    await queryRunner.query(`
      ALTER TABLE public.stk_remito_items
      ALTER COLUMN cantidad_tipo1 DROP DEFAULT,
      ALTER COLUMN cantidad_tipo2 DROP DEFAULT
    `);

    // 4) (Opcional) Dropear columnas viejas si existen
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='stk_remito_items' AND column_name='cantidad_blanco'
        ) THEN
          EXECUTE 'ALTER TABLE public.stk_remito_items DROP COLUMN cantidad_blanco';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='stk_remito_items' AND column_name='cantidad_negro'
        ) THEN
          EXECUTE 'ALTER TABLE public.stk_remito_items DROP COLUMN cantidad_negro';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down básico: recrear columnas viejas y copiar de vuelta
    await queryRunner.query(`
      ALTER TABLE public.stk_remito_items
      ADD COLUMN IF NOT EXISTS cantidad_blanco numeric(18,4),
      ADD COLUMN IF NOT EXISTS cantidad_negro numeric(18,4)
    `);

    await queryRunner.query(`
      UPDATE public.stk_remito_items
      SET cantidad_blanco = cantidad_tipo1,
          cantidad_negro  = cantidad_tipo2
    `);

    await queryRunner.query(`
      ALTER TABLE public.stk_remito_items
      DROP COLUMN IF EXISTS cantidad_tipo1,
      DROP COLUMN IF EXISTS cantidad_tipo2
    `);
  }
}
