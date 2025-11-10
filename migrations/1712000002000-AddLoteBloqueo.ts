import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoteBloqueo1712000002000 implements MigrationInterface {
  name = 'AddLoteBloqueo1712000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.stk_lotes
      ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_stk_lotes_bloqueado
      ON public.stk_lotes(bloqueado);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_stk_lotes_bloqueado;
    `);

    await queryRunner.query(`
      ALTER TABLE public.stk_lotes
      DROP COLUMN IF EXISTS bloqueado;
    `);
  }
}
