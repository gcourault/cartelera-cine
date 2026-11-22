// Cine Círculo Paraná: API de la plataforma GAF (la misma que usa su web).
import { getJson, sleep } from "../util.js";

const API = "https://apiv2.gaf.adro.studio";
const CINEMA_ID = 19; // Paraná (Entre Ríos)

export default async function circulo() {
  const now = (await getJson(`${API}/nowPlaying/${CINEMA_ID}`)).data;
  const showtimes = [];
  const movies = [];
  for (const m of now) {
    await sleep(300);
    const det = (await getJson(`${API}/movie/${CINEMA_ID}/${m.pref}`)).data;
    const mv = det.movie;
    movies.push({
      title: mv.nombre,
      poster: mv.poster || m.poster?.path || null,
      // sinopsis del cine: solo como último recurso, NO es la reseña independiente
      synopsis: mv.descripcion || null,
      trailer: mv.urlTrailer || null,
      durationMin: Number(mv.Duracion) || null,
      rating: mv.Condicion || null,
    });
    for (const s of det.showtimes) {
      if (s.mostrar === "0") continue;
      const [date, time] = s.fechaHora.date.split(" ");
      showtimes.push({
        title: mv.nombre,
        date,
        time: time.slice(0, 5),
        format: s.formato,
        language: s.lenguaje === "Subt" ? "Subtitulada" : s.lenguaje === "Cast" ? "Castellano" : s.lenguaje,
      });
    }
  }
  return {
    cinema: { id: "circulo", name: "Cine Círculo", city: "Paraná", address: "Andrés Pazos 339", url: "https://www.cinecirculo.com.ar/" },
    movies,
    showtimes,
  };
}
