// Cinemark Santa Fe (Ribera Shopping): se lee la página renderizada, como un usuario.
import { launchBrowser, toISO, todayISO, sleep } from "../util.js";

const URL = "https://www.cinemark.com.ar/cartelera/santafe";

// Cada película es un bloque con un <h2>; el texto interno es: duración, clasificación, título,
// y luego pares "formato / · idioma / HH:MMhs".
const EXTRACT = () => {
  const out = [];
  for (const h2 of document.querySelectorAll("h2")) {
    let card = h2;
    while (card.parentElement && card.parentElement.querySelectorAll("h2").length < 2) card = card.parentElement;
    if (card === h2) continue;
    out.push({ title: h2.innerText.trim(), lines: card.innerText.split("\n").map((s) => s.trim()).filter(Boolean) });
  }
  return out;
};

export function parseLines(lines) {
  const res = [];
  let format = "", language = "";
  for (const l of lines) {
    let m;
    if ((m = /^(\d)H (\d+)M$/i.exec(l))) continue;
    if (/^(2D|3D|4D|XD|DBOX|D-BOX|PREMIER|INFINITY.*)$/i.test(l)) format = l.toUpperCase();
    else if (l.startsWith("·")) language = l.replace("·", "").trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());
    else if ((m = /^(\d{1,2}:\d{2})\s*hs$/i.exec(l))) res.push({ time: m[1].padStart(5, "0"), format, language });
  }
  return res;
}

export default async function cinemark() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector("h2", { state: "attached", timeout: 20000 });
    const showtimes = [];
    const seen = new Set();
    // Lee los días de la pestaña activa (CARTELERA o PREVENTA).
    const readTab = async () => {
      const n = (await page.$$(".swiper-slide")).length;
      for (let i = 0; i < n; i++) {
        const slide = (await page.$$(".swiper-slide"))[i];
        if (!slide) continue;
        const label = (await slide.innerText()).replace(/\s+/g, " ").trim(); // "HOY" | "LUN 23/NOV" | "MAR 1/DIC"
        let date;
        const m = /(\d{1,2})\/([A-ZÑ]{3})/i.exec(label);
        if (/^HOY/i.test(label)) date = todayISO();
        else if (m) date = toISO(m[1], m[2]);
        else continue;
        if (seen.has(date)) continue;
        seen.add(date);
        await slide.click().catch(() => {});
        await sleep(1200);
        for (const c of await page.evaluate(EXTRACT)) {
          if (/PRIVACIDAD/i.test(c.title)) continue; // aviso de cookies, no es una película
          for (const s of parseLines(c.lines)) showtimes.push({ title: c.title, date, ...s });
        }
      }
    };
    await readTab();
    // Preventa: estrenos de los próximos días (p. ej. los jueves) que no están en la pestaña CARTELERA.
    const pre = page.locator("text=/^PREVENTA$/i").first();
    if (await pre.count()) {
      await pre.click().catch(() => {});
      await sleep(2000);
      await readTab();
    }
    return {
      cinema: { id: "cinemark", name: "Cinemark Santa Fe", city: "Santa Fe", address: "Dique 1 Puerto de Santa Fe, Ribera Shopping", url: URL },
      movies: [],
      showtimes,
    };
  } finally {
    await browser.close();
  }
}
