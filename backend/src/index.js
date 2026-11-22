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
for (const [name, fn] of Object.entries(SCRAPERS)) {
  if (only && only !== name) continue;
  try {
    let r = await fn().catch((e) => { console.warn(`  ${name} falló (${e.message}), reintento…`); return null; });
    // Reintento si falló o si trajo mucho menos que la corrida anterior (la web cargó incompleta).
    if (!r || r.showtimes.length < prevCount(r.cinema.id) * 0.8) { r = await fn(); }
    console.log(`✔ ${name}: ${r.showtimes.length} funciones`);
    if (r.showtimes.length === 0) console.warn(`⚠ ${name} devolvió 0 funciones (¿cambió la web?)`);
    results.push(r);
  } catch (e) {
    console.error(`✘ ${name}: ${e.message}`);
  }
}
await mkdir("out", { recursive: true });
await writeFile("out/raw.json", JSON.stringify(results, null, 1));
if (!only) {
  const out = await addReviews(await enrich(merge(results), process.env.TMDB_TOKEN));
  await writeFile("out/cartelera.json", JSON.stringify(out, null, 1));
  console.log(`→ out/cartelera.json: ${out.movies.length} películas, ${out.showtimes.length} funciones, ${out.cinemas.length} cines`);
}
