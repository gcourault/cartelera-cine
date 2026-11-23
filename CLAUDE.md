# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PWA con la cartelera de cines de Santa Fe y Paraná (Cinemark Santa Fe, Cine América, Cine Círculo, Cine Las Tipas, Shopping La Paz). Idioma del proyecto (código, commits, UI): español rioplatense.

## Comandos

- Recolector: `cd backend && npm ci && npm run build` (equivale a `node --env-file=.env src/index.js`). Necesita `backend/.env` con `TMDB_TOKEN=...`; sin él no hay pósters/sinopsis de TMDB.
- Un solo scraper (no corre TMDB, reseñas ni merge; solo reescribe `out/raw.json`): `node --env-file=.env src/index.js cinemark` (nombres: `circulo`, `sunstar`, `cinemark`, `lastipas`, `cineamerica`).
- Probar la app local: `cp backend/out/cartelera.json app/ && python3 -m http.server -d app`. `app/cartelera.json` está en `.gitignore`: lo genera el workflow.
- No hay tests ni linter. Validar con `node --check <archivo>`.
- Scrapers con navegador (`cinemark`, etc.) usan `playwright-core` con el **Chrome del sistema** (`channel: "chrome"`), no descargan uno propio. Tardan ~2–4 min en total.
- Ver corridas: `gh run list`, `gh run watch <id>`. Lanzar a mano: `gh workflow run actualizar.yml`.

## Arquitectura

Pipeline en `backend/src/index.js`: cada scraper en `scrapers/*.js` devuelve `{ cinema, movies, showtimes }` → `merge.js` los une → `tmdb.js` (`enrich`) agrega póster/sinopsis/géneros → `reviews.js` (`addReviews`) agrega críticas → `out/cartelera.json`. La app (`app/`, JS sin dependencias ni build) solo lee ese JSON.

Puntos que requieren leer varios archivos:

- **Identidad de películas.** Los cines escriben los títulos distinto (Cinemark recorta, hay sufijos 2D/3D/SUB). `util.normTitle` normaliza y `merge.js` arma un título canónico por prefijo (≥3 palabras). El `id` de película (`movie.id`, slug del título canónico) es la clave de TMDB, de las cachés y de los overrides.
- **TMDB.** `tmdb.js` valida el resultado por título y, si hay duración, por runtime (±10 min); solo acepta películas de los últimos 2 años. Cuando acierta mal o no encuentra, se corrige en `backend/src/tmdb-overrides.json` (`{ "<movie.id>": <tmdbId> }`); el override manda sobre la caché. Es la forma habitual de arreglar pósters faltantes (ver commits "Póster manual para…").
- **Cachés** en `backend/out/*-cache.json` (TMDB y reseñas). `out/` está ignorado por git; en CI se persiste con `actions/cache` (solo `*-cache.json`, por eso `raw.json` no sobrevive entre corridas).
- **Detección de fallos.** `index.js` reintenta un scraper si falla o trae <80 % de lo que tenía `raw.json`. Un cine que lanza error o devuelve 0 funciones se registra en `out/problemas.txt`; el sitio se publica igual y el job `avisar` pone la corrida en rojo. `out/resumen.md` (funciones por cine, películas sin póster o sin match en TMDB) va al resumen de la corrida en Actions.
- **Fechas.** `merge.js` descarta funciones pasadas y a más de 14 días (preventas). La app vuelve a filtrar las ya empezadas con la hora del dispositivo. El workflow corre con `TZ=America/Argentina/Buenos_Aires`; los scrapers dependen de esa zona.

## App y service worker

- Todo contenido externo se inserta con `textContent`/`h()` (nunca `innerHTML`); las URLs pasan por `safeUrl`. Mantener esa regla.
- `app/sw.js`: app en caché primero (con actualización en segundo plano), `cartelera.json` red primero, pósters caché primero. Por eso, tras un cambio en la app, la primera apertura puede mostrar la versión vieja.
- La versión de caché (`SHELL = "cartelera-shell-…"`) la reemplaza el workflow por el hash del commit antes de publicar (`sed` anclado a `SHELL = "…"`). No hace falta subirla a mano; si se cambia esa línea, hay que mantener el patrón o el paso de CI falla a propósito.

## Publicación

`.github/workflows/actualizar.yml` corre en cada push a `main`, a mano, y por cron a las 06:00 y 14:00 hora Argentina (`0 9` y `0 17` UTC). Job `build` (scrapea, verifica ≥30 funciones, arma el sitio con `app/` + `cartelera.json`) → `deploy` (GitHub Pages) → `avisar`. Necesita el secret `TMDB_TOKEN`. Hacer push a `main` publica el sitio: no pushear sin que el usuario lo pida.

## Créditos obligatorios

El footer de la app debe conservar el aviso de TMDB ("no avalado ni certificado por TMDB"). Las críticas se enlazan a su medio original; no se copian (`WITH_QUOTES = false` en `reviews.js`).
