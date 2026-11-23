import { writeFile, mkdir } from "node:fs/promises";
import circulo from "./scrapers/circulo.js";
import sunstar from "./scrapers/sunstar.js";
import { enrich } from "./tmdb.js";
import { addReviews } from "./reviews.js";
import { merge } from "./merge.js";
import cinemark from "./scrapers/cinemark.js";
import lastipas from "./scrapers/lastipas.js";
import cineamerica from "./scrapers/cineamerica.js";

const SCRAPERS = { circulo, sunstar, cinemark, lastipas, cineamerica };
const only = process.argv[2]; // npm run build -- circulo

import { readFile } from "node:fs/promises";
const prev = JSON.parse(await readFile("out/raw.json", "utf8").catch(() => "[]"));
const prevCount = (id) => prev.find((r) => r.cinema.id === id)?.showtimes.length ?? 0;
const results = [];
const problemas = []; // cines caídos o vacíos: la cartelera se publica igual, pero la corrida queda en rojo
for (const [name, fn] of Object.entries(SCRAPERS)) {
  if (only && only !== name) continue;
  try {
    let r = await fn().catch((e) => { console.warn(`  ${name} falló (${e.message}), reintento…`); return null; });
    // Reintento si falló o si trajo mucho menos que la corrida anterior (la web cargó incompleta).
    if (!r || r.showtimes.length < prevCount(r.cinema.id) * 0.8) { r = await fn(); }
    console.log(`✔ ${name}: ${r.showtimes.length} funciones`);
    if (r.showtimes.length === 0) { console.warn(`⚠ ${name} devolvió 0 funciones (¿cambió la web?)`); problemas.push(`${name}: 0 funciones (¿cambió la web o no hay cartelera?)`); }
    results.push(r);
  } catch (e) {
    console.error(`✘ ${name}: ${e.message}`);
    problemas.push(`${name}: falló (${e.message})`);
  }
}
await mkdir("out", { recursive: true });
await writeFile("out/raw.json", JSON.stringify(results, null, 1));
if (!only) {
  const out = await addReviews(await enrich(merge(results), process.env.TMDB_TOKEN));
  await writeFile("out/cartelera.json", JSON.stringify(out, null, 1));
  const sinPoster = out.movies.filter((m) => !m.poster);
  const sinTmdb = out.movies.filter((m) => m.tmdbId === null);
  if (sinPoster.length) console.warn(`⚠ Sin póster (${sinPoster.length}): ${sinPoster.map((m) => m.title).join(", ")}`);
  const md = [
    "## Cartelera actualizada",
    `${out.movies.length} películas, ${out.showtimes.length} funciones, ${out.cinemas.length} cines.`,
    "",
    "### Funciones por cine",
    ...out.cinemas.map((c) => `- ${c.name}: ${out.showtimes.filter((s) => s.cinemaId === c.id).length}`),
    "",
    problemas.length ? "### ❌ Problemas\n" + problemas.map((p) => `- ${p}`).join("\n") : "Sin problemas en los cines.",
    "",
    sinPoster.length ? "### 🖼️ Películas sin póster (corregir con `backend/src/tmdb-overrides.json`)\n" + sinPoster.map((m) => `- ${m.title} (\`${m.id}\`)`).join("\n") : "Todas las películas tienen póster.",
    sinTmdb.length ? "\n### Sin coincidencia en TMDB\n" + sinTmdb.map((m) => `- ${m.title} (\`${m.id}\`)`).join("\n") : "",
  ].join("\n");
  await writeFile("out/resumen.md", md + "\n");
  await writeFile("out/problemas.txt", problemas.join("; "));
  for (const p of problemas) console.log(`::error::${p}`);
  console.log(`→ out/cartelera.json: ${out.movies.length} películas, ${out.showtimes.length} funciones, ${out.cinemas.length} cines`);
}
