// Utilidades compartidas por los scrapers.
export const UA = "Mozilla/5.0 (X11; Linux x86_64) CarteleraPersonal/0.1";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}
export async function getJson(url) {
  return JSON.parse(await getText(url));
}

// "Los Juegos del Hambre: Amanecer en la Cosecha" -> "los juegos del hambre amanecer en la cosecha"
export function normTitle(s) {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(2d|3d|4d|xd|subtitulada|castellano|doblada|infinity|vision|premier|dbox)\b/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const todayISO = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local

const MONTHS = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };

// (día, mes en texto) -> "YYYY-MM-DD", resolviendo el cambio de año diciembre→enero.
export function toISO(day, monthName) {
  const now = new Date();
  const m = MONTHS[monthName.toUpperCase().replace(/[^A-ZÑ]/g, "")];
  if (!m) throw new Error(`Mes desconocido: ${monthName}`);
  let y = now.getFullYear();
  if (m < now.getMonth() + 1 - 6) y += 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

import { chromium } from "playwright-core";
// Chrome del sistema (no hace falta descargar otro navegador).
export const launchBrowser = () => chromium.launch({ channel: "chrome", headless: true });
