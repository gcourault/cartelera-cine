// Cartelera: app web sin dependencias. Todo el contenido externo se inserta con textContent (nunca innerHTML).
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const localISO = (d = new Date()) => d.toLocaleDateString("sv-SE");
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function dayLabel(iso) {
  const today = localISO(), tomorrow = localISO(new Date(Date.now() + 864e5));
  if (iso === today) return "Hoy";
  if (iso === tomorrow) return "Mañana";
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

const state = { data: null, city: "Todas", cinema: "Todos", day: null };

async function load() {
  try {
    const res = await fetch("cartelera.json", { cache: "no-cache" });
    state.data = await res.json();
  } catch {
    $("list").replaceChildren(h("p", { class: "empty" }, "No se pudo cargar la cartelera. Probá de nuevo con conexión."));
    return;
  }
  const d = state.data;
  d.cinemaById = Object.fromEntries(d.cinemas.map((c) => [c.id, c]));
  d.movieById = Object.fromEntries(d.movies.map((m) => [m.id, m]));
  const gen = new Date(d.generatedAt), horas = (Date.now() - gen) / 36e5;
  const upd = $("updated");
  upd.textContent = "Actualizada: " + gen.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  upd.classList.toggle("stale", horas > 20); // se actualiza 2 veces por día: más de 20 h sin cambios es raro
  if (horas > 20) upd.textContent += ` ⚠ datos de hace ${Math.floor(horas)} h, pueden estar desactualizados`;
  render();
}

// Funciones que todavía no empezaron (en este dispositivo), de las ciudades elegidas.
function upcoming() {
  const now = new Date(), today = localISO(now), hm = now.toTimeString().slice(0, 5);
  const { cinemaById } = state.data;
  return state.data.showtimes.filter((s) => (s.date > today || (s.date === today && s.time >= hm)) && (state.city === "Todas" || cinemaById[s.cinemaId]?.city === state.city) && (state.cinema === "Todos" || s.cinemaId === state.cinema));
}

function render() {
  const d = state.data, shows = upcoming();
  const cities = ["Todas", ...new Set(d.cinemas.map((c) => c.city))];
  $("cities").replaceChildren(...cities.map((c) => h("button", { class: "chip", "aria-pressed": c === state.city, onclick: () => { state.city = c; state.cinema = "Todos"; render(); } }, c)));

  // Chips de cine: solo los de la ciudad elegida; se ocultan si hay uno solo (no hay nada que filtrar).
  const cines = d.cinemas.filter((c) => state.city === "Todas" || c.city === state.city);
  $("cinemas").hidden = cines.length < 2;
  $("cinemas").replaceChildren(...[{ id: "Todos", name: "Todos los cines" }, ...cines].map((c) => h("button", { class: "chip", "aria-pressed": c.id === state.cinema, onclick: () => { state.cinema = c.id; render(); } }, c.name)));

  const days = [...new Set(shows.map((s) => s.date))].sort().slice(0, 8);
  if (!days.includes(state.day)) state.day = days[0] || null;
  $("days").replaceChildren(...days.map((x) => h("button", { class: "chip", "aria-pressed": x === state.day, onclick: () => { state.day = x; render(); } }, dayLabel(x))));

  const byMovie = new Map();
  for (const s of shows.filter((s) => s.date === state.day)) (byMovie.get(s.movieId) ?? byMovie.set(s.movieId, []).get(s.movieId)).push(s);
  if (!byMovie.size) { $("list").replaceChildren(h("p", { class: "empty" }, "No hay funciones para esta selección.")); return; }

  const cards = [...byMovie].map(([id, ss]) => ({ m: d.movieById[id], ss })).sort((a, b) => b.ss.length - a.ss.length).map(({ m, ss }) => card(m, ss));
  $("list").replaceChildren(...cards);
}

const poster = (m, cls = "poster") => (safeUrl(m.poster) ? h("img", { class: cls, src: m.poster, alt: "Póster de " + m.title, loading: "lazy" }) : h("div", { class: cls }, m.title));
const meta = (m) => [m.year, m.durationMin && m.durationMin + " min", m.rating, ...(m.genres || []).slice(0, 2)].filter(Boolean).join(" · ");

function timeChip(s) {
  const tags = [s.format && s.format !== "2D" ? s.format : null, /sub/i.test(s.language) ? "SUB" : null].filter(Boolean).join(" ");
  return h("span", { class: "t" }, s.time, tags && h("small", {}, tags));
}
function cinemaGroups(ss) {
  const by = new Map();
  for (const s of ss) (by.get(s.cinemaId) ?? by.set(s.cinemaId, []).get(s.cinemaId)).push(s);
  return [...by].map(([cid, list]) => h("div", { class: "cine" }, h("b", {}, state.data.cinemaById[cid].name + " · " + state.data.cinemaById[cid].city),
    h("div", { class: "times" }, list.sort((a, b) => a.time.localeCompare(b.time)).map(timeChip))));
}

function card(m, ss) {
  return h("button", { class: "card", onclick: () => openDetail(m) }, poster(m),
    h("div", {}, h("h2", {}, m.title), h("div", { class: "meta" }, meta(m)), cinemaGroups(ss)));
}

function openDetail(m) {
  const d = state.data, all = upcoming().filter((s) => s.movieId === m.id);
  const days = [...new Set(all.map((s) => s.date))].sort();
  const reviews = (m.reviews || []).filter((r) => safeUrl(r.url));
  const sec = $("detail");
  sec.replaceChildren(
    h("div", { class: "bar" }, h("button", { onclick: () => history.back() }, "← Volver")),
    h("div", { class: "hero" }, poster(m), h("div", {}, h("h2", {}, m.title), h("div", { class: "meta" }, meta(m)),
      safeUrl(m.trailer) && h("a", { class: "link", href: m.trailer, target: "_blank", rel: "noopener" }, "▶ Ver tráiler"))),
    m.synopsis && h("div", { class: "sec" }, h("h3", {}, "Sinopsis"), h("p", {}, m.synopsis)),
    h("div", { class: "sec" }, h("h3", {}, "Críticas independientes"),
      reviews.length ? reviews.map((r) => h("a", { class: "rev", href: r.url, target: "_blank", rel: "noopener" },
        h("small", {}, `${r.source} (${r.country}) · ${r.date}`), r.headline.replace(/^(Estrenos?|Streaming|Series)( online)?:\s*/i, "").replace(/^RESEÑA\s*[–-]\s*/i, ""))) : h("p", { class: "meta" }, "Todavía no encontramos críticas en español.")),
    h("div", { class: "sec" }, h("h3", {}, "Días y horarios"),
      days.map((day) => h("div", { class: "dayrow" }, h("span", {}, dayLabel(day) + " " + parseISO(day).toLocaleDateString("es-AR", { day: "numeric", month: "short" })), cinemaGroups(all.filter((s) => s.date === day))))),
  );
  sec.hidden = false; sec.scrollTop = 0; document.body.style.overflow = "hidden";
  history.pushState({ d: 1 }, "");
}
function close() { $("detail").hidden = true; document.body.style.overflow = ""; }
addEventListener("popstate", close);
document.addEventListener("keydown", (e) => e.key === "Escape" && close());
document.addEventListener("visibilitychange", () => !document.hidden && state.data && render()); // al volver a la app, quita funciones ya empezadas

load();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
