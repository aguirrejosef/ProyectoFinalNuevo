import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import InfoClub from '../InfoClub/InfoClub'
import Resenas from '../Resenas/Resenas'
import ReservaTurno from '../ReservaTurno/ReservaTurno'
import { apiFetch } from '../../api'
import { ordenarCanchasPorNombre } from '../../utils/ordenarNatural'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faTableTennisPaddleBall } from '@fortawesome/free-solid-svg-icons'
import "./Club.css"

function Club() {
  const { id } = useParams();

  const [club, setClub] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState(null);
  const [pasoReserva, setPasoReserva] = useState('eligiendo');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorDatosClub, setErrorDatosClub] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      setError('');

      try {
        const resClub = await apiFetch(`/clubes/${id}`);
        const dataClub = await resClub.json();

        if (!resClub.ok) {
          setError(dataClub.message || 'No se pudo cargar el club');
          return;
        }

        setClub(dataClub);

        const [resCanchas, resFotos, resServicios] = await Promise.all([
          apiFetch(`/club/canchas?id_club=${id}`),
          apiFetch(`/club/fotos?id_club=${id}`),
          apiFetch(`/club/servicios?id_club=${id}`)
        ]);

        const dataCanchas = await resCanchas.json();
        const dataFotos = await resFotos.json();
        const dataServicios = await resServicios.json();

        // Si alguno de estos tres pedidos falla, no es que el club no tenga
        // canchas/fotos/servicios cargados: es que no pudimos consultarlos.
        // Avisamos en vez de mostrar silenciosamente "no hay nada".
        if (!resCanchas.ok || !resFotos.ok || !resServicios.ok) {
          setErrorDatosClub(true);
        }

        setCanchas(resCanchas.ok && Array.isArray(dataCanchas) ? ordenarCanchasPorNombre(dataCanchas) : []);
        setFotos(resFotos.ok && Array.isArray(dataFotos) ? dataFotos : []);
        setServicios(resServicios.ok && Array.isArray(dataServicios) ? dataServicios : []);

      } catch (err) {
        console.error('Error al cargar el club:', err);
        setError('Error al conectar con el servidor');
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [id]);

  // Cuando el cliente publica, edita o elimina una reseña, el promedio del
  // encabezado (que viene de este mismo fetch inicial) queda desactualizado
  // hasta que se recarga la página entera. Lo volvemos a pedir solo a él.
  const actualizarResumenResenas = async () => {
    try {
      const res = await apiFetch(`/clubes/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setClub((prev) => prev && ({
        ...prev,
        promedio_resenas: data.promedio_resenas,
        cantidad_resenas: data.cantidad_resenas
      }));
    } catch (err) {
      console.error('Error al actualizar el resumen de reseñas:', err);
    }
  };

  const formatearPrecio = (precio) => {
    if (precio === null || precio === undefined || precio === '') return null;
    return Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  };

  const handleFotoAnterior = () => {
    setFotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
  };

  const handleFotoSiguiente = () => {
    setFotoIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
  };

  const handleVerEnMapa = () => {
    const direccionCompleta = [club?.direccion, club?.localidad].filter(Boolean).join(', ');
    if (!direccionCompleta) return;
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}`, '_blank');
  };

  if (cargando) {
    return (
      <div>
        <NavBar />
        <p className="mensaje-club">Cargando club...</p>
        <Footer />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div>
        <NavBar />
        <p className="mensaje-club">{error || 'No se encontró el club'}</p>
        <Footer />
      </div>
    );
  }

  return (
    <div className="pagina-club">
      <NavBar />

      {fotos.length > 0 && (
        <div className="carrusel-club">
          <img src={fotos[fotoIndex]?.url} alt={club.nombre} className="carrusel-club-img" />

          {fotos.length > 1 && (
            <>
              <button type="button" className="carrusel-club-flecha carrusel-club-flecha-izq" onClick={handleFotoAnterior} aria-label="Foto anterior">
                ‹
              </button>
              <button type="button" className="carrusel-club-flecha carrusel-club-flecha-der" onClick={handleFotoSiguiente} aria-label="Foto siguiente">
                ›
              </button>
              <div className="carrusel-club-puntos">
                {fotos.map((_, i) => (
                  <span
                    key={i}
                    className={`carrusel-club-punto ${i === fotoIndex ? 'carrusel-club-punto-activo' : ''}`}
                    onClick={() => setFotoIndex(i)}
                  ></span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="tarjeta-encabezado-club">
        <h1 className="nombre-club">{club.nombre}</h1>
        {club.cantidad_resenas > 0 && (
          <p className="resumen-resenas-club">
            <span className="resumen-resenas-estrella">★</span> {club.promedio_resenas}
            <span className="resumen-resenas-cantidad"> ({club.cantidad_resenas} reseña{club.cantidad_resenas === 1 ? '' : 's'})</span>
          </p>
        )}
        {(club.direccion || club.localidad) && (
          <p className="direccion-club">
            <FontAwesomeIcon icon={faLocationDot} />
            {' '}{[club.direccion, club.localidad].filter(Boolean).join(', ')}
          </p>
        )}
        {club.direccion && (
          <button type="button" className="btn-ver-en-mapa" onClick={handleVerEnMapa}>
            (ver en mapa)
          </button>
        )}
      </div>

      <div className="seccion-canchas-club">
        {pasoReserva === 'eligiendo' && (
          <>
            <h2 className="titulo-seccion-canchas">
              <FontAwesomeIcon icon={faTableTennisPaddleBall} /> Elegí tu turno
            </h2>

            {canchas.length === 0 && errorDatosClub && (
              <p className="mensaje-club">No se pudieron cargar las canchas de este club. Intentá de nuevo más tarde.</p>
            )}

            {canchas.length === 0 && !errorDatosClub && (
              <p className="mensaje-club">Este club todavía no cargó canchas.</p>
            )}

            {canchas.length > 0 && (
              <div className="grid-canchas-club">
                {canchas.map((c) => {
                  const disponible = c.estado === 'disponible';
                  return (
                    <button
                      type="button"
                      key={c.id_cancha}
                      disabled={!disponible}
                      title={disponible ? undefined : 'Esta cancha no está disponible en este momento'}
                      className={`tarjeta-cancha-club ${canchaSeleccionada === c.id_cancha ? 'tarjeta-cancha-club-elegida' : ''} ${!disponible ? 'tarjeta-cancha-club-no-disponible' : ''}`}
                      onClick={() => disponible && setCanchaSeleccionada(c.id_cancha)}
                    >
                      {!disponible && (
                        <span className="tarjeta-cancha-club-badge-no-disponible">No disponible</span>
                      )}
                      <span className="tarjeta-cancha-club-nombre">{c.nombre}</span>
                      {c.tipo && <span className="tarjeta-cancha-club-tipo">{c.tipo}</span>}
                      {disponible && formatearPrecio(c.precio) && (
                        <span className="tarjeta-cancha-club-precio">{formatearPrecio(c.precio)}</span>
                      )}
                      {disponible && formatearPrecio(c.precio_nocturno) && (
                        <span className="tarjeta-cancha-club-precio-noche">
                          Noche: {formatearPrecio(c.precio_nocturno)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {canchaSeleccionada && (
          <ReservaTurno
            club={club}
            cancha={canchas.find((c) => c.id_cancha === canchaSeleccionada)}
            onCambiarPaso={setPasoReserva}
          />
        )}
      </div>

      <InfoClub
        direccion={club.direccion}
        localidad={club.localidad}
        telefono={club.telefono}
        horariosAtencion={club.horarios_atencion}
        servicios={servicios}
      />

      <Resenas idClub={id} onCambio={actualizarResumenResenas} />

      <Footer />
    </div>
  )
}

export default Club
