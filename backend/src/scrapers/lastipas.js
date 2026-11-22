// Cine Las Tipas Paraná: página Next.js que arma la cartelera en el navegador.
import { launchBrowser, toISO, sleep } from "../util.js";

const URL = "https://parana.lastipas.com.ar/es-AR";

const EXTRACT = () =>
  [...document.querySelectorAll("h4")]
    .map((h4) => {
      if (!h4.querySelector("a")) return null; // los títulos de película son <h4><a>; las secciones no
      let card = h4;
      while (card.parentElement && !/Horarios/.test(card.innerText)) card = card.parentElement;
      if (!/Horarios/.test(card.innerText) || card.querySelectorAll("h4").length !== 1) return null;
      const img = card.querySelector("img");
      return { title: h4.innerText.trim(), poster: img?.src || null, lines: card.innerText.split("\n").map((s) => s.trim()).filter(Boolean) };
    })
    .filter(Boolean);

export function parseCard(lines) {
  const val = (label) => lines[lines.findIndex((l) => l.startsWith(label)) + 1];
  const format = val("Formato") || "2D";
  const i = lines.indexOf("Horarios");
  const times = [];
  let sub = false;
  for (const l of lines.slice(i + 1)) {
    if (/^SUB$/i.test(l)) sub = true;
    else if (/^\d{1,2}:\d{2}$/.test(l)) { times.push({ time: l.padStart(5, "0"), format, language: sub ? "Subtitulada" : "Castellano" }); sub = false; }
  }
  return { times, durationMin: parseInt(lines.find((l) => /^\d+ min$/.test(l))) || null, genre: lines[lines.findIndex((l) => l.startsWith("Lanzamiento")) - 1] || null, rating: val("Clasificación") || null };
}

export default async function lastipas() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".snap-center", { state: "attached", timeout: 30000 });
    await page.waitForSelector("h4 a", { state: "attached", timeout: 30000 });
    await sleep(2000);
    const total = (await page.$$(".snap-center")).length;
    const showtimes = [], movies = new Map();
    // Espera a que la lista de películas se estabilice (la página la carga después del clic).
    const settle = async () => {
      let last = -1, stable = 0;
      for (let i = 0; i < 16 && stable < 3; i++) { // máx ~8 s
        await sleep(500);
        const n = (await page.evaluate(EXTRACT)).length;
        stable = n === last && n > 0 ? stable + 1 : 0;
        last = n;
      }
      return page.evaluate(EXTRACT);
    };
    for (let i = 0; i < total; i++) {
      const d = (await page.$$(".snap-center"))[i]; // se vuelve a buscar: el DOM se redibuja
      if (!d) continue;
      const m = /(\d{1,2})\s+([A-Za-zñÑ]+)/.exec((await d.innerText().catch(() => "")).replace(/\s+/g, " "));
      if (!m || !/^(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)/i.test((await d.innerText()).trim())) continue;
      const date = toISO(m[1], m[2]);
      await d.click({ timeout: 4000 }).catch(() => {});
      const cards = await settle();
      for (const c of cards) {
        const p = parseCard(c.lines);
        if (!movies.has(c.title)) movies.set(c.title, { title: c.title, poster: c.poster, durationMin: p.durationMin, rating: p.rating, genre: p.genre });
        for (const t of p.times) showtimes.push({ title: c.title, date, ...t });
      }
    }
    return {
      cinema: { id: "lastipas", name: "Cine Las Tipas", city: "Paraná", address: "Shopping Paso del Paraná, Corrientes y San Lorenzo", url: URL },
      movies: [...movies.values()],
      showtimes,
    };
  } finally {
    await browser.close();
  }
}
