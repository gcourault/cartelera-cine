// Cine del Shopping La Paz (Sunstar, Paraná): HTML del lado del servidor, un día por pedido.
import * as cheerio from "cheerio";
import { getText, sleep, todayISO } from "../util.js";

const BASE = "https://boleteria.cinesunstar.com/GetShowsByCinema.php?CinemaId=8008";
const LANGS = { castellano: "Castellano", subtitulada: "Subtitulada", subt: "Subtitulada" };

function parseHeading(raw) {
  let t = raw.replace(/\s+/g, " ").trim();
  let format = "2D", language = "";
  t = t.replace(/\b(Castellano|Subtitulada|Subt)\b/i, (m) => ((language = LANGS[m.toLowerCase()]), ""));
  t = t.replace(/\b([234]D)\b/i, (m) => ((format = m.toUpperCase()), ""));
  return { title: t.replace(/\s+/g, " ").trim(), format, language };
}

export default async function sunstar() {
  const first = cheerio.load(await getText(BASE));
  // Primer menú de días = cartelera regular (los siguientes son preventas lejanas).
  const dates = first("ul.nav-pills").first().find("a")
    .map((_, a) => /date=(\d{4}-\d\d-\d\d)/.exec(first(a).attr("href"))?.[1]).get().filter(Boolean);

  const showtimes = [];
  for (const date of dates) {
    await sleep(300);
    const $ = cheerio.load(await getText(`${BASE}&date=${date}`));
    $("h4").each((_, h) => {
      if ($(h).find("svg.bi-film").length === 0) return; // solo títulos de película
      const { title, format, language } = parseHeading($(h).text());
      $(h).nextUntil("h4").filter("a").each((__, a) => {
        const time = /(\d{1,2}:\d{2})/.exec($(a).text())?.[1];
        if (time) showtimes.push({ title, date, time: time.padStart(5, "0"), format, language });
      });
    });
  }
  return {
    cinema: { id: "sunstar", name: "Cine Shopping La Paz", city: "Paraná", address: "Venezuela 61", url: BASE },
    movies: [],
    showtimes,
  };
}
