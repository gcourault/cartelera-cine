// Une las salidas de todos los scrapers en un único cartelera.json.
import { normTitle } from "./util.js";

const MAX_DAYS_AHEAD = 14; // más lejos = preventas; se descartan por ahora

const pretty = (t) => t.trim().toLowerCase().replace(/(^|[\s:¿¡(-])(\S)/g, (_, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Del|La|Las|Los|El|En|Y|Con|Un|Una|Vs|A)\b/g, (w, _w, off) => (off === 0 ? w : w.toLowerCase()));

export function merge(results, now = new Date()) {
  const today = now.toLocaleDateString("sv-SE");
  const limit = new Date(now.getTime() + MAX_DAYS_AHEAD * 864e5).toLocaleDateString("sv-SE");
  const nowHM = now.toTimeString().slice(0, 5);

  // 1) Títulos canónicos: un título cuyas palabras son prefijo de otro (≥3 palabras) es la misma película
  //    (Cinemark recorta "…: AMANECER").
  const keys = new Set();
  for (const r of results) for (const s of r.showtimes) keys.add(normTitle(s.title));
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const canon = new Map();
  for (const k of sorted) {
    const parent = [...canon.values()].find((c) => c === k || (k.split(" ").length >= 3 && (c + " ").startsWith(k + " ")));
    canon.set(k, parent || k);
  }

  const movies = new Map(); // key -> movie
  const cinemas = [];
  const showtimes = [];
  const seen = new Set();

  for (const r of results) {
    cinemas.push(r.cinema);
    const info = new Map((r.movies || []).map((m) => [canon.get(normTitle(m.title)), m]));
    for (const s of r.showtimes) {
      if (s.date < today || s.date > limit) continue;
      if (s.date === today && s.time < nowHM) continue;
      const key = canon.get(normTitle(s.title));
      if (!movies.has(key)) movies.set(key, { id: key.replace(/ /g, "-"), key, titles: new Set(), poster: null, durationMin: null, rating: null, genre: null, trailer: null });
      const mv = movies.get(key);
      mv.titles.add(s.title);
      const i = info.get(key);
      if (i) {
        mv.poster ||= i.poster; mv.durationMin ||= i.durationMin; mv.rating ||= i.rating; mv.genre ||= i.genre; mv.trailer ||= i.trailer;
      }
      const id = [r.cinema.id, key, s.date, s.time, s.format, s.language].join("|");
      if (seen.has(id)) continue; // misma función en 2 salas con idéntico dato
      seen.add(id);
      showtimes.push({ cinemaId: r.cinema.id, movieId: mv.id, date: s.date, time: s.time, format: s.format, language: s.language });
    }
  }

  const movieList = [...movies.values()].map((m) => {
    // título legible: prefiero el que tiene mayúsculas/minúsculas mezcladas (no TODO MAYÚSCULAS) y más largo
    const t = [...m.titles].sort((a, b) => (b !== b.toUpperCase()) - (a !== a.toUpperCase()) || b.length - a.length)[0];
    const { titles, key, ...rest } = m;
    return { ...rest, title: t === t.toUpperCase() ? pretty(t) : t.replace(/\s*(\d[dD]\s*\+\s*\d[dD]|\d[dD])\b.*$/, "").trim() || t };
  });
  showtimes.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { generatedAt: now.toISOString(), cinemas, movies: movieList.sort((a, b) => a.title.localeCompare(b.title)), showtimes };
}
