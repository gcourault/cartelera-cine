// Completa pósters, título oficial, géneros y año con TMDB. Caché en out/tmdb-cache.json.
import { readFile, writeFile } from "node:fs/promises";
import { normTitle, sleep } from "./util.js";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const CACHE = "out/tmdb-cache.json";

async function tmdb(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
  if (res.status === 401) throw new Error("TMDB rechazó el token (401). Revisá backend/.env");
  if (!res.ok) throw new Error(`TMDB ${res.status} ${path.split("?")[0]}`);
  return res.json();
}

export async function enrich(cartelera, token) {
  if (!token) { console.warn("⚠ Sin TMDB_TOKEN: se omiten pósters y datos de TMDB"); return cartelera; }
  const overrides = JSON.parse(await readFile("src/tmdb-overrides.json", "utf8").catch(() => "{}"));
  const cache = JSON.parse(await readFile(CACHE, "utf8").catch(() => "{}"));
  const genres = Object.fromEntries((await tmdb("/genre/movie/list?language=es", token)).genres.map((g) => [g.id, g.name]));

  for (const m of cartelera.movies) {
    if (!(m.id in cache)) {
      await sleep(250);
      const q = encodeURIComponent(m.title.replace(/\s*\(.*?\)\s*/g, " "));
      const { results } = await tmdb(`/search/movie?query=${q}&language=es-AR&include_adult=false`, token);
      const want = normTitle(m.title);
      // Acepto el resultado si el título (traducido u original) coincide, para no pegar un póster equivocado.
      const recent = (r) => Number(r.release_date?.slice(0, 4)) >= new Date().getFullYear() - 2; // la cartelera es de estrenos recientes
      const cands = results.filter((r) => recent(r) && [r.title, r.original_title].some((t) => normTitle(t) === want || normTitle(t).startsWith(want) || want.startsWith(normTitle(t))));
      let hit = null;
      if (overrides[m.id]) hit = (await tmdb(`/movie/${overrides[m.id]}?language=es-AR`, token)) && { ...(await tmdb(`/movie/${overrides[m.id]}?language=es-AR`, token)), genre_ids: [] };
      else if (m.durationMin) {
        // Verifico por duración (±10 min) para no confundir remakes u homónimas.
        for (const c of cands.slice(0, 4)) {
          const d = await tmdb(`/movie/${c.id}?language=es-AR`, token);
          if (d.runtime && Math.abs(d.runtime - m.durationMin) <= 10) { hit = { ...c, runtime: d.runtime }; break; }
        }
      } else hit = cands[0] || null;
      cache[m.id] = hit ? { tmdbId: hit.id, title: hit.title, originalTitle: hit.original_title, poster: hit.poster_path, overview: hit.overview, year: hit.release_date?.slice(0, 4), genres: hit.genres ? hit.genres.map((g) => g.name) : (hit.genre_ids || []).map((g) => genres[g]).filter(Boolean), rating: hit.vote_average } : null;
    }
    const t = cache[m.id];
    if (!t) { m.tmdbId = null; continue; }
    m.tmdbId = t.tmdbId;
    m.originalTitle = t.originalTitle || null;
    m.year = t.year || null;
    m.genres = t.genres;
    m.poster = t.poster ? IMG + t.poster : m.poster; // prefiero el de TMDB (calidad uniforme); si no hay, el del cine
    m.tmdbRating = t.rating || null;
    m.synopsis = t.overview || null; // sinopsis general; NO es la reseña independiente
  }
  await writeFile(CACHE, JSON.stringify(cache, null, 1));
  return cartelera;
}
