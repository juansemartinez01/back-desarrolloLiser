const fs = require('fs');
const axios = require('axios');

const URL = process.env.URL; // base url, ej https://.../api
const FILE = process.env.FILE; // path absoluto al json
const CHUNK = Number(process.env.CHUNK || 200);

// ✅ nuevo: desde qué índice arrancar (para retomar)
const START = Number(process.env.START || 0);

// ✅ nuevo: reintentos por chunk
const RETRIES = Number(process.env.RETRIES || 3);

function wrapRow(r) {
  return r;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function postChunk(chunk) {
  return axios.post(
    `${URL}/fin/proveedores/import`,
    { proveedores: chunk },
    {
      headers: { 'Content-Type': 'application/json' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000, // 2 min por chunk
    },
  );
}

async function main() {
  if (!URL || !FILE) {
    console.error(
      'Falta URL o FILE. Ej: URL=https://... FILE=./converted.json node import-proveedores-json-chunks.js',
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(FILE, 'utf8');
  const arr = JSON.parse(raw);

  if (!Array.isArray(arr)) {
    throw new Error('El JSON debe ser un array de registros');
  }

  console.log(
    'Total registros:',
    arr.length,
    '| Chunk:',
    CHUNK,
    '| Start:',
    START,
    '| Retries:',
    RETRIES,
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = START; i < arr.length; i += CHUNK) {
    const chunk = arr.slice(i, i + CHUNK).map(wrapRow);
    const chunkNum = Math.floor(i / CHUNK) + 1;
    const range = `[${i}..${Math.min(i + CHUNK - 1, arr.length - 1)}]`;

    let attempt = 0;
    while (true) {
      try {
        const res = await postChunk(chunk);

        inserted += res.data.inserted || 0;
        updated += res.data.updated || 0;
        skipped += res.data.skipped || 0;

        console.log(`Chunk ${chunkNum} OK ${range} =>`, res.data);
        break; // ✅ sale del retry loop
      } catch (e) {
        attempt++;
        const err = e.response?.data || e.message;

        console.error(
          `❌ Chunk ${chunkNum} FAIL ${range} (attempt ${attempt}/${RETRIES}) =>`,
          err,
        );

        if (attempt >= RETRIES) {
          console.error(
            `\nABORTADO. Para retomar: set START=${i} y re-ejecutá.\n` +
              `Ej (PowerShell): $env:START="${i}" ; node .\\import-proveedores-json-chunks.js\n`,
          );
          process.exit(1);
        }

        // backoff simple
        await sleep(1000 * attempt);
      }
    }
  }

  console.log(
    'FIN => inserted:',
    inserted,
    'updated:',
    updated,
    'skipped:',
    skipped,
  );
}

main().catch((e) => {
  console.error(e.response?.data || e.message);
  process.exit(1);
});
