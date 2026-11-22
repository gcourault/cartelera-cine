// Reseñas independientes en español: se busca la crítica de la película en medios con API WordPress pública.
// Se guarda medio + titular + enlace + una cita corta (≤ 220 caracteres) con atribución. No se copia la nota.
import { readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { normTitle, sleep, UA } from "./util.js";

const CACHE = "out/reviews-cache.json";
const MAX_REVIEWS = 3;
const WITH_QUOTES = false; // la cita automática salía fuera de contexto; se muestra solo medio + titular + enlace
// Orden = prioridad. Se omiten sitios que bloquean consultas automáticas (Culturageek, Espinof).
const SOURCES = [
  { name: "Micropsia Cine", country: "AR", base: "https://www.micropsiacine.com" },
  { name: "Hipertextual", country: "ES", base: "https://hipertextual.com", slugSuffix: "-critica" },
  { name: "Paloma y Nacho", country: "MX", base: "https://palomaynacho.com" },
];
const IS_REVIEW = /cr[ií]tica|rese[ñn]a/i;
const BIO = /\b(es|fue) (creador|periodista|licenciad|escritor|cr[ií]tic)|Universidad|suscr[ií]b|newsletter/i; // pie de autor, no opinión
const OPINION = /\b(logra|falla|funciona|actuaci|gui[oó]n|direcci[oó]n|el film|la pel[ií]cula|resulta|no alcanza|se destaca|ritmo|puesta)/i;

const decode = (s) => cheerio.load(`<i>${s}</i>`).text().replace(/\s+/g, " ").trim();
const clip = (t, n = 220) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n)).replace(/[,;:]$/, "") + "…");

async function searchPosts(base, q) {
  const url = `${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=20&_fields=title,link,date`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  return res.json();
}

const slugify = (s) => normTitle(s).replace(/ /g, "-");

async function bySlug(base, slug) {
  const res = await fetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=title,link,date`, { headers: { "User-Agent": UA } });
  return res.ok ? res.json() : [];
}

async function opinionQuote(link) {
  try {
    const res = await fetch(link, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const ps = $("article p, .entry-content p, p").map((_, e) => $(e).text().replace(/\s+/g, " ").trim()).get().filter((t) => t.length >= 120 && t.length <= 600 && !BIO.test(t));
    const tail = ps.slice(Math.floor(ps.length * 0.4)); // las opiniones suelen estar después de la sinopsis inicial
    const p = tail.find((t) => OPINION.test(t));
    if (!p) return null;
    const first = p.match(/^.*?[.!?](?=\s|$)/)?.[0] || p;
    return clip(first);
  } catch { return null; }
}

export async function findReviews(movie) {
  // Algunos medios titulan solo con el subtítulo ("Amanecer en la cosecha"): también busco por esa parte.
  const sub = movie.title.includes(":") ? movie.title.split(":").slice(1).join(":").trim() : null;
  const names = [...new Set([movie.title, sub, movie.originalTitle].filter(Boolean))];
  const wants = names.map(normTitle).filter((w) => w.length >= 8 || (w.length >= 4 && w === normTitle(movie.title)));
  const minDate = Date.now() - 450 * 864e5; // evita críticas de películas homónimas viejas
  const found = [];
  for (const src of SOURCES) {
    if (found.length >= MAX_REVIEWS) break;
    for (const q of names) {
      await sleep(400);
      let posts = await searchPosts(src.base, q).catch(() => []);
      if (src.slugSuffix) posts = posts.concat(await bySlug(src.base, slugify(q) + src.slugSuffix).catch(() => []));
      const hit = posts.find((p) => {
        const t = decode(p.title.rendered);
        return IS_REVIEW.test(t) && new Date(p.date) >= minDate && wants.some((w) => normTitle(t).includes(w));
      });
      if (hit) {
        found.push({ source: src.name, country: src.country, headline: decode(hit.title.rendered), url: hit.link, date: hit.date.slice(0, 10), quote: WITH_QUOTES ? await opinionQuote(hit.link) : null });
        break;
      }
    }
  }
  return found;
}

export async function addReviews(cartelera) {
  const cache = JSON.parse(await readFile(CACHE, "utf8").catch(() => "{}"));
  for (const m of cartelera.movies) {
    const c = cache[m.id];
    const stale = !c || (c.reviews.length === 0 && Date.now() - c.fetchedAt > 864e5);
    if (stale) cache[m.id] = { fetchedAt: Date.now(), reviews: await findReviews(m) };
    m.reviews = cache[m.id].reviews;
  }
  await writeFile(CACHE, JSON.stringify(cache, null, 1));
  return cartelera;
}
