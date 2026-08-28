import React from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import './Novedades.css'
 
// NOTA: el contenido de novedades y de las secciones "Próximamente" es de
// EJEMPLO. Cuando el ranking y "Falta Uno" existan de verdad, esas dos
// secciones se conectan a datos reales igual que hicimos con turnos.
const NOVEDADES = [
  {
    id: 1,
    categoria: 'torneos',
    titulo: 'Torneo Apertura 2026',
    fecha: '15 de septiembre',
    resumen: 'Inscripciones abiertas para el torneo de apertura en clubes adheridos de Tucumán. Categorías 4ta, 5ta y 6ta, mixto y caballeros.'
  },
  {
    id: 5,
    categoria: 'torneos',
    titulo: 'Torneo Femenino de Verano',
    fecha: '10 de octubre',
    resumen: 'Primera edición del torneo femenino, abierto a todas las categorías. Cupos limitados por club.'
  },
  {
    id: 3,
    categoria: 'noticias',
    titulo: 'El pádel sigue creciendo en Argentina',
    fecha: '2 de septiembre',
    resumen: 'Cada vez más clubes se suman a la actividad y crece la cantidad de jugadores federados en todo el país.'
  },
  {
    id: 2,
    categoria: 'promociones',
    titulo: '2x1 en horarios de la mañana',
    fecha: 'Todo septiembre',
    resumen: 'Varios clubes de la plataforma ofrecen 2x1 en turnos de 8 a 12hs. Mirá qué clubes participan en la sección Clubes.'
  },
  {
    id: 4,
    categoria: 'tips',
    titulo: 'Cómo elegir tu primera pala',
    fecha: '28 de agosto',
    resumen: 'Peso, balance y forma: te contamos qué tener en cuenta antes de comprar tu primera pala de pádel.'
  },
  {
    id: 6,
    categoria: 'tips',
    titulo: '5 ejercicios para mejorar tu volea',
    fecha: '20 de agosto',
    resumen: 'Rutina simple para entrenar la volea antes de tu próximo partido, ideal para hacer en 15 minutos.'
  }
]
 
const SECCIONES = [
  { key: 'torneos', label: 'Torneos', etiqueta: 'COMPETENCIA', bajada: 'Enterate de los próximos torneos organizados por los clubes de la plataforma.' },
  { key: 'noticias', label: 'Noticias', etiqueta: 'ACTUALIDAD', bajada: 'Lo que está pasando en el mundo del pádel, en un solo lugar.' },
  { key: 'promociones', label: 'Promociones', etiqueta: 'DESCUENTOS', bajada: 'Beneficios puntuales de los clubes adheridos, por tiempo limitado.' },
  { key: 'tips', label: 'Tips y Consejos', etiqueta: 'PARA MEJORAR', bajada: 'Técnica, equipamiento y consejos para tu próximo partido.' }
]
 
function Novedades() {
  const navigate = useNavigate();
  const rol = localStorage.getItem('rol');
  const esClub = Number(rol) === 2;
 
  return (
    <div className="novedades-pagina">
      <NavBar/>
 
      {/* ------------------ Hero ------------------ */}
      <section className="nov-hero">
        <span className="nov-eyebrow">— NOVEDADES</span>
        <h1 className="nov-hero-titulo">
          Todo lo nuevo, <span className="nov-resaltado">en un solo lugar.</span>
        </h1>
        <p className="nov-hero-subtitulo">
          Torneos, noticias, promociones y funciones nuevas de la plataforma.
        </p>
      </section>
 
      {/* ------------------ Tarjetas destacadas ------------------ */}
      <section className="nov-highlights">
        {SECCIONES.map((s) => (
          <a href={`#${s.key}`} key={s.key} className="nov-highlight-card">
            <h3>{s.label}</h3>
            <span className="nov-highlight-label">{s.etiqueta}</span>
            <p>{s.bajada}</p>
          </a>
        ))}
      </section>
 
      {/* ------------------ Secciones por categoría ------------------ */}
      {SECCIONES.map((seccion) => {
        const items = NOVEDADES.filter((n) => n.categoria === seccion.key);
        if (items.length === 0) return null;
 
        return (
          <section id={seccion.key} key={seccion.key} className="nov-seccion">
            <span className="nov-eyebrow">— {seccion.label.toUpperCase()}</span>
            <div className="nov-grid">
              {items.map((n) => (
                <div key={n.id} className="nov-card">
                  <span className="nov-card-fecha">{n.fecha}</span>
                  <h4>{n.titulo}</h4>
                  <p>{n.resumen}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
 
      {/* ------------------ Ranking (próximamente) ------------------ */}
      <section className="nov-feature">
        <div className="nov-feature-texto">
          <span className="nov-badge-proximamente">PRÓXIMAMENTE</span>
          <span className="nov-eyebrow">• RANKING Y REPUTACIÓN</span>
          <h2>Jugá. Sumá puntos.<br/><span className="nov-resaltado">Ganá reputación.</span></h2>
          <p>Vas a poder ver tu posición en el ranking de tu zona según los partidos que jugaste, con tu porcentaje de victorias y tu puntaje.</p>
        </div>
 
        <div className="nov-feature-visual">
          <div className="nov-mock-header">
            <span>ASÍ SE VA A VER EL RANKING</span>
            <span className="nov-mock-tag">Pádel · Mensual</span>
          </div>
 
          <div className="nov-mock-fila">
            <span className="nov-mock-pos">1</span>
            <span className="nov-mock-avatar">MM</span>
            <div className="nov-mock-info">
              <strong>Matías M.</strong>
              <small>41 PJ · 82% WR</small>
            </div>
            <span className="nov-mock-score">★ 4.8 · 1845</span>
          </div>
 
          <div className="nov-mock-fila">
            <span className="nov-mock-pos">2</span>
            <span className="nov-mock-avatar">JR</span>
            <div className="nov-mock-info">
              <strong>Julieta R.</strong>
              <small>33 PJ · 76% WR</small>
            </div>
            <span className="nov-mock-score">★ 4.7 · 1790</span>
          </div>
 
          <div className="nov-mock-fila">
            <span className="nov-mock-pos">3</span>
            <span className="nov-mock-avatar">FL</span>
            <div className="nov-mock-info">
              <strong>Facundo L.</strong>
              <small>29 PJ · 71% WR</small>
            </div>
            <span className="nov-mock-score">★ 4.6 · 1712</span>
          </div>
        </div>
      </section>
 
      {/* ------------------ Falta Uno (próximamente) ------------------ */}
      <section className="nov-feature nov-feature-invertido">
        <div className="nov-feature-texto">
          <span className="nov-badge-proximamente">PRÓXIMAMENTE</span>
          <span className="nov-eyebrow">• FALTA UNO — COMPLETÁ TU EQUIPO</span>
          <h2>¿Te faltan jugadores?<br/><span className="nov-resaltado">Acá los vas a encontrar.</span></h2>
          <p>Vas a poder abrir tu partido a la comunidad para que otros jugadores cerca tuyo se sumen y completen tu equipo, sin vueltas.</p>
        </div>
 
        <div className="nov-feature-visual">
          <div className="nov-mock-header">
            <span>ASÍ SE VAN A VER LOS PARTIDOS ABIERTOS</span>
          </div>
 
          <div className="nov-mock-partido">
            <div className="nov-mock-partido-info">
              <strong>Pádel 5 · Villa Crespo</strong>
              <small>Un complejo cerca tuyo · Cancha 2</small>
            </div>
            <span className="nov-mock-hora">21:00 <small>HOY</small></span>
          </div>
          <div className="nov-mock-partido-footer">
            <span>Falta 1 · $6.200 c/u</span>
            <button type="button" className="nov-mock-btn" disabled>Sumarme</button>
          </div>
 
          <div className="nov-mock-partido">
            <div className="nov-mock-partido-info">
              <strong>Pádel · Belgrano</strong>
              <small>Club ejemplo · Pádel 1</small>
            </div>
            <span className="nov-mock-hora">19:30 <small>MAR</small></span>
          </div>
          <div className="nov-mock-partido-footer">
            <span>Faltan 2 · $3.200 c/u</span>
            <button type="button" className="nov-mock-btn" disabled>Sumarme</button>
          </div>
        </div>
      </section>
 
      {/* ------------------ CTA para clubes (solo si NO sos club ya) ------------------ */}
      {!esClub && (
        <section className="nov-cta-clubes">
          <div className="nov-cta-texto">
            <span className="nov-eyebrow">— PARA CLUBES</span>
            <h2>Sumá tu club.<br/><span className="nov-resaltado">Nosotros nos ocupamos del resto.</span></h2>
            <p>Publicá tus canchas, gestioná turnos y llegá a más jugadores de tu zona.</p>
            <div className="nov-cta-botones">
              <button type="button" className="nov-btn-primario" onClick={() => navigate('/registro-club')}>
                Registrá tu club →
              </button>
              <button type="button" className="nov-btn-secundario" onClick={() => navigate('/planes')}>
                Ver planes
              </button>
            </div>
          </div>
 
          <ul className="nov-cta-lista">
            <li><strong>Panel</strong> Gestioná reservas, canchas y horarios desde un solo lugar</li>
            <li><strong>Visibilidad</strong> Tu cancha disponible para todos los jugadores de la plataforma</li>
            <li><strong>Simple</strong> Sumá tu club en minutos, sin complicaciones</li>
          </ul>
        </section>
      )}
 
      <div className="contenedor-btnFlotanteWsp">
        <BtnFlotanteWp
          NroCelular={'3814653130'}
        />
      </div>
      <Footer/>
    </div>
  )
}
 
export default Novedades