// Cine América (Santa Fe): la cartelera se publica como texto libre en Platea Santa Fe.
// La URL (agenda 20290) es fija; cambia el texto cada semana.
import * as cheerio from "cheerio";
import { getText, toISO } from "../util.js";

const URL = "https://plateasantafe.com.ar/platea/detalleagenda/20290";
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const noAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pageText = (html) => {
  const $ = cheerio.load(html);
  $("script,style").remove();
  $("br,p,div,li,h1,h2,h3,h4").each((_, e) => void $(e).append("\n"));
  return $.root().text().replace(/ /g, " ").split("\n").map((s) => s.trim()).filter(Boolean);
};

// Prefijo de una línea de horarios, sin acentos: "jueves:", "martes y miercoles:". Exige nombres de día para
// no confundirlo con títulos con dos puntos ("HECHIZO: BIENVENIDOS A HEXE").
const DAY = `(?:${DAYS.map(noAccent).join("|")})`;
const DAY_PREFIX = new RegExp(`^${DAY}(?:(?: y |, ?)${DAY})*\\s*:`);

// "Horarios del 19 al 25 de noviembre de 2026:" -> { "jueves": "2026-11-19", ... }
function weekMap(lines) {
  const l = lines.find((x) => /^Horarios del/i.test(x));
  const m = l && /del (\d{1,2})(?: de (\w+))? al (\d{1,2}) de (\w+)(?: de (\d{4}))?/i.exec(l);
  if (!m) throw new Error("No encontré el rango de fechas de Cine América");
  const [, d1, mon1, d2, mon2, year] = m;
  const start = new Date(toISO(d1, mon1 || mon2) + "T12:00:00");
  const end = new Date(toISO(d2, mon2) + "T12:00:00");
  if (year) { start.setFullYear(+year); end.setFullYear(+year); }
  const map = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) map[noAccent(DAYS[d.getDay()])] = d.toLocaleDateString("sv-SE");
  return map;
}

export function parse(lines) {
  const week = weekMap(lines);
  const from = lines.findIndex((x) => /^Horarios del/i.test(x)) + 1;
  const out = [];
  let title = null;
  for (const line of lines.slice(from)) {
    if (/^(Términos|Politica|Política)/i.test(line)) break;
    if (/^-{3,}$/.test(line)) continue;
    // "de Andrey Zvyagintsev, Francia, Letonia, 2026, 135m." -> la línea anterior era el título
    if (/^de .+,.*\d{2,3}m\.?$/i.test(line)) continue;
    // Líneas de días: "Jueves: 20:15hs. - Viernes: 18:00hs." o "Martes y miércoles: 17:45 y 22:00hs."
    const dayParts = line.split(/\s+-\s+/).filter((p) => DAY_PREFIX.test(noAccent(p)));
    if (dayParts.length && title) {
      for (const part of dayParts) {
        const [days, times] = part.split(/:(.+)/s);
        const dates = noAccent(days).split(/ y |, /).map((d) => week[d.trim()]).filter(Boolean);
        const hhmm = [...times.matchAll(/(\d{1,2}:\d{2})/g)].map((m) => m[1].padStart(5, "0"));
        for (const date of dates) for (const time of hhmm) out.push({ title, date, time, format: "2D", language: "" });
      }
      continue;
    }
    // Línea de título: casi todo en mayúsculas
    if (/[A-ZÁÉÍÓÚÑ]{3}/.test(line) && line === line.toUpperCase() && !/^(ESTRENO|\d+(ra|da|era|ta)? SEMANA)/i.test(line)) {
      // Los rótulos de ciclo ("TEMPORADA 74 CINE CLUB", "ORGULLOSA CICLO DE CINE QUEER") preceden al título real;
      // el título es la última línea en mayúsculas antes de "de <director>".
      title = line;
    }
  }
  return out;
}

export default async function cineamerica() {
  const lines = pageText(await getText(URL));
  const showtimes = parse(lines);
  const clean = (t) => t.replace(/\s+/g, " ").trim();
  for (const s of showtimes) s.title = clean(s.title).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return {
    cinema: { id: "cineamerica", name: "Cine América", city: "Santa Fe", address: "25 de Mayo 3075", url: URL },
    movies: [],
    showtimes,
  };
}
