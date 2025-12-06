// scripts/sync/sync-unidades-tipos.js

const { Client } = require('pg');

// ----- CONFIG BASE VIEJA -----
const oldDb = new Client({
    
  host: 'turntable.proxy.rlwy.net',
  port: 35157,
  user: 'postgres',
  password: 'FptVsHZhVcpRTzKTdSzCGpGIeavsuOVY',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});


// ----- CONFIG BASE NUEVA -----
const newDb = new Client({
  host: 'nozomi.proxy.rlwy.net',
  port: 37452,
  user: 'postgres',
  password: 'RoTdRzavZQAYVoYbHAXdcdgsTlzmEvSW',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});


// -------------------------------------

function generarCodigoUnidad(nombre) {
  const n = nombre.trim();

  if (/^[0-9]+kg$/i.test(n)) {
    // 1kg → UND_1KG
    const num = n.replace(/kg/i, '');
    return `UND_${num}KG`;
  }

  if (/und/i.test(n)) {
    // “12 Und” → UND_12UND
    const num = n.replace(/\D/g, '');
    return `UND_${num}UND`;
  }

  if (n === '-' || n === '') {
    return 'UND_SINDEFINIR';
  }

  return `UND_OTROS_${Math.floor(Math.random() * 9999)}`;
}

async function run() {
  await oldDb.connect();
  await newDb.connect();

  console.log('Conectado a ambas bases 💾');

  // ==========================================
  // 1️⃣ SINCRONIZAR UNIDADES
  // ==========================================
  const unidadesViejas = await oldDb.query(`
    SELECT id, nombre, abreviatura FROM unidad ORDER BY id;
  `);

  console.log(
    `Unidades encontradas en módulo viejo: ${unidadesViejas.rows.length}`,
  );

  for (const u of unidadesViejas.rows) {
    const codigo = generarCodigoUnidad(u.nombre);

    await newDb.query(
      `
      INSERT INTO stk_unidades (id, codigo, nombre, abreviatura, activo, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET codigo = EXCLUDED.codigo,
          nombre = EXCLUDED.nombre,
          abreviatura = EXCLUDED.abreviatura,
          activo = TRUE,
          updated_at = NOW();
    `,
      [u.id, codigo, u.nombre, u.abreviatura],
    );

    console.log(`→ Unidad sincronizada: ID=${u.id} (${u.nombre})`);
  }

  // ==========================================
  // 2️⃣ SINCRONIZAR TIPOS DE PRODUCTO
  // ==========================================
  const tiposViejos = await oldDb.query(`
    SELECT id, nombre FROM tipo_producto ORDER BY id;
  `);

  console.log(`Tipos encontrados en módulo viejo: ${tiposViejos.rows.length}`);

  for (const t of tiposViejos.rows) {
    await newDb.query(
      `
      INSERT INTO stk_tipos_producto (id, nombre, descripcion, activo, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET nombre = EXCLUDED.nombre,
          descripcion = EXCLUDED.descripcion,
          activo = TRUE,
          updated_at = NOW();
    `,
      [t.id, t.nombre, `Categoría importada: ${t.nombre}`],
    );

    console.log(`→ Tipo sincronizado: ID=${t.id} (${t.nombre})`);
  }

  console.log('\n🎉 Sincronización completada con éxito\n');

  await oldDb.end();
  await newDb.end();
}

run().catch((err) => {
  console.error('Error ejecutando sincronización:', err);
  process.exit(1);
});
