# Cartelera Santa Fe y Paraná

App web instalable (PWA) con la cartelera de Cinemark Santa Fe, Cine América, Cine Círculo,
Cine Las Tipas y el cine del Shopping La Paz: póster, sinopsis, críticas independientes en español,
días y horarios.

- `backend/`: recolector (Node 22). `cd backend && npm ci && node --env-file=.env src/index.js`
  Necesita `backend/.env` con `TMDB_TOKEN=...` (opcional: sin él no hay pósters de TMDB).
- `app/`: la app (HTML/JS sin dependencias). Lee `cartelera.json`.
- `.github/workflows/actualizar.yml`: actualiza y publica en GitHub Pages dos veces por día.

Probar local: copiar `backend/out/cartelera.json` a `app/` y `python3 -m http.server -d app`.

Pósters y sinopsis: TMDB. Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
Las críticas se enlazan a su medio original; no se copian.
