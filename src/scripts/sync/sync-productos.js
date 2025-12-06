/**
 * SYNC PRODUCTOS (OLD → NEW)
 * -----------------------------------------
 * Solo sincroniza productos del módulo viejo (AWS/Old)
 * hacia el módulo nuevo (Railway).
 *
 * NO escribe en la db vieja.
 */

const { Client } = require('pg');

// ===============================
// CONFIGURACIÓN
// ===============================

// OLD (módulo viejo)
const oldDb = new Client({
  host: 'turntable.proxy.rlwy.net',
  port: 35157,
  user: 'postgres',
  password: 'FptVsHZhVcpRTzKTdSzCGpGIeavsuOVY',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

// NEW (módulo nuevo)
const newDb = new Client({
  host: 'nozomi.proxy.rlwy.net',
  port: 37452,
  user: 'postgres',
  password: 'RoTdRzavZQAYVoYbHAXdcdgsTlzmEvSW',
  database: 'railway',
});

// ===============================
// GENERACIÓN DE CÓDIGO COMERCIAL
// ===============================

function quitarAcentos(txt) {
  if (!txt) return '';
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, (m) => (m === 'ñ' ? 'n' : 'N'));
}

function buildTipoPrefix(tipoNombre) {
  if (!tipoNombre) return 'XXX';
  const t = quitarAcentos(tipoNombre).toUpperCase().trim();
  return t.slice(0, 3);
}

function buildNombreCode(nombre) {
  if (!nombre) return 'XXXX';

  const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y']);
  const base = quitarAcentos(nombre).toUpperCase();
  const words = base
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP.has(w));

  const parts = [];
  for (const w of words) {
    if (/^\d+$/.test(w)) parts.push(w.padStart(2, '0'));
    else parts.push(w.slice(0, 4));
  }

  return parts.join('').slice(0, 20);
}

function buildProveedorCode(proveedorId) {
  const id = proveedorId ?? 0;
  return 'P' + id.toString().padStart(4, '0');
}

function buildEmpresaCode(empresa) {
  if (!empresa) return 'XXXX';
  const e = quitarAcentos(empresa)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return e.slice(0, 4) || 'XXXX';
}

function buildInternoCode(idInterno) {
  if (!idInterno) return '00000';
  return idInterno.toString().padStart(5, '0');
}

function generarCodigoComercial({
  tipoNombre,
  nombreProducto,
  proveedorId,
  empresa,
  idInterno,
}) {
  const tipo = buildTipoPrefix(tipoNombre);
  const nombre = buildNombreCode(nombreProducto);
  const prov = buildProveedorCode(proveedorId);
  const emp = buildEmpresaCode(empresa);
  const interno = buildInternoCode(idInterno);

  return `${tipo}-${nombre}-${prov}-${emp}-${interno}`;
}

// ===============================
// UNICIDAD DEL CÓDIGO PARA UPDATE
// ===============================

async function asegurarCodigoUnicoParaUpdate(baseCode, newDb, myIdInterno) {
  let code = baseCode;
  let counter = 1;

  while (true) {
    const existe = await newDb.query(
      `SELECT 1 
       FROM stk_productos 
       WHERE codigo_comercial = $1
       AND (id_interno IS NULL OR id_interno <> $2)
       LIMIT 1`,
      [code, myIdInterno],
    );

    if (existe.rowCount === 0) return code;

    code = `${baseCode}-${String(counter).padStart(2, '0')}`;
    counter++;
  }
}

// ===============================
// SYNC OLD → NEW
// ===============================

async function sync() {
  await oldDb.connect();
  await newDb.connect();

  console.log('🔄 Conectado a ambas bases…');

  const oldRows = (
    await oldDb.query(`
      SELECT p.*, 
             u.nombre AS unidad_nombre, 
             t.nombre AS tipo_nombre
      FROM productos p
      LEFT JOIN unidad u ON u.id = p.unidad_id
      LEFT JOIN tipo_producto t ON t.id = p.tipo_producto_id
    `)
  ).rows;

  const newRows = (await newDb.query(`SELECT * FROM stk_productos`)).rows;

  const newMap = new Map(newRows.map((r) => [String(r.id_interno), r]));

  console.log(`📦 OLD: ${oldRows.length} productos`);
  console.log(`📦 NEW: ${newRows.length} productos`);

  for (const old of oldRows) {
    const idInt = old.id_interno?.toString() ?? null;
    const match = idInt ? newMap.get(idInt) : null;

    // generar código base
    const codigoBase = generarCodigoComercial({
      tipoNombre: old.tipo_nombre,
      nombreProducto: old.nombre,
      proveedorId: old.proveedor_id,
      empresa: old.empresa,
      idInterno: idInt,
    });

    // código final garantizando unicidad
    const codigo = await asegurarCodigoUnicoParaUpdate(
      codigoBase,
      newDb,
      idInt,
    );

    if (!match) {
      console.log(`🟢 Creando NEW producto → ${old.nombre}`);

      await newDb.query(
        `
        INSERT INTO stk_productos
        (nombre, precio_base, unidad_id, tipo_producto_id, descripcion, vacio, oferta,
         precio_oferta, activo, imagen, precio_vacio, id_interno, empresa,
         codigo_comercial, created_at, updated_at)
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW(), NOW())
      `,
        [
          old.nombre,
          old.precio_base,
          old.unidad_id,
          old.tipo_producto_id,
          old.descripcion,
          old.vacio,
          old.oferta,
          old.precio_oferta,
          old.activo,
          old.imagen,
          old.precio_vacio,
          idInt,
          old.empresa,
          codigo,
        ],
      );
    } else {
      console.log(`🔵 Actualizando NEW → ${old.nombre}`);

      await newDb.query(
        `
        UPDATE stk_productos SET
          nombre=$1,
          precio_base=$2,
          unidad_id=$3,
          tipo_producto_id=$4,
          descripcion=$5,
          vacio=$6,
          oferta=$7,
          precio_oferta=$8,
          activo=$9,
          imagen=$10,
          precio_vacio=$11,
          empresa=$12,
          codigo_comercial=$13,
          updated_at=NOW()
        WHERE id_interno=$14
      `,
        [
          old.nombre,
          old.precio_base,
          old.unidad_id,
          old.tipo_producto_id,
          old.descripcion,
          old.vacio,
          old.oferta,
          old.precio_oferta,
          old.activo,
          old.imagen,
          old.precio_vacio,
          old.empresa,
          codigo,
          idInt,
        ],
      );
    }
  }

  console.log('✅ SINCRONIZACIÓN COMPLETA (OLD → NEW)');
  await oldDb.end();
  await newDb.end();
}

sync().catch((err) => console.error('❌ ERROR EN SYNC:', err));
