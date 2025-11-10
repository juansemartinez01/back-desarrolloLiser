// 1729800000000-RenameColorToLoteTipo.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameColorToLoteTipo1729800000000 implements MigrationInterface {
  name = 'RenameColorToLoteTipo1729800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Agrego nueva columna nullable para poder migrar sin romper nada
    await queryRunner.query(`
      ALTER TABLE stk_lotes
      ADD COLUMN lote_tipo SMALLINT
    `);

    // 2) Migración de datos: COMPLETAR el CASE con tu mapeo real (ejemplos)
    //   - Reemplazá 'TIPO1'/'TIPO2' por los valores reales de tu columna color
    await queryRunner.query(`
      UPDATE stk_lotes
      SET lote_tipo = CASE
        WHEN color IN ('BLANCO') THEN 1
        WHEN color IN ('NEGRO') THEN 2
        ELSE NULL
      END
    `);

    // 3) Validación: si quedó algo sin mapear, fallar explícitamente
    const { count } = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM stk_lotes WHERE lote_tipo IS NULL
    `).then((rows: any[]) => rows[0]);
    if (count > 0) {
      throw new Error(
        `Hay ${count} filas sin mapeo de color->lote_tipo. Ajustá el CASE de la migración antes de continuar.`
      );
    }

    // 4) Constraint + NOT NULL + índice
    await queryRunner.query(`
      ALTER TABLE stk_lotes
      ADD CONSTRAINT chk_stk_lotes_lote_tipo CHECK (lote_tipo IN (1,2))
    `);
    await queryRunner.query(`
      ALTER TABLE stk_lotes
      ALTER COLUMN lote_tipo SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stk_lotes_lote_tipo ON stk_lotes(lote_tipo)
    `);

    // 5) (Opcional) Dropear índice viejo si existía sobre color
    // Si tu index se llama distinto, cambialo aquí:
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stk_lotes_color') THEN
        DROP INDEX idx_stk_lotes_color;
      END IF;
    END $$;`);

    // 6) Dropear columna vieja
    await queryRunner.query(`ALTER TABLE stk_lotes DROP COLUMN color`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1) Volver a crear color
    await queryRunner.query(`
      ALTER TABLE stk_lotes
      ADD COLUMN color VARCHAR(10)
    `);

    // 2) Mapeo inverso (ajustá a tus valores originales)
    await queryRunner.query(`
      UPDATE stk_lotes
      SET color = CASE lote_tipo
        WHEN 1 THEN 'TIPO1'
        WHEN 2 THEN 'TIPO2'
        ELSE NULL
      END
    `);

    // 3) Sanity check
    const { count } = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM stk_lotes WHERE color IS NULL
    `).then((rows: any[]) => rows[0]);
    if (count > 0) {
      throw new Error(
        `Quedaron ${count} filas sin mapeo de lote_tipo->color. Ajustá el CASE del DOWN.`
      );
    }

    // 4) NOT NULL/índice (si correspondía)
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_stk_lotes_color ON stk_lotes(color)'
    );

    // 5) Limpiar constraint/índice de lote_tipo y dropearla
    await queryRunner.query(
      'ALTER TABLE stk_lotes DROP CONSTRAINT IF EXISTS chk_stk_lotes_lote_tipo'
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_stk_lotes_lote_tipo'
    );
    await queryRunner.query(
      'ALTER TABLE stk_lotes DROP COLUMN lote_tipo'
    );
  }
}
