import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import InfoClub from '../InfoClub/InfoClub'
import ReservaTurno from '../ReservaTurno/ReservaTurno'
import { apiFetch } from '../../api'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons'
import "./Club.css"

function Club() {
  const { id } = useParams();

  const [club, setClub] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
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

        setCanchas(Array.isArray(dataCanchas) ? dataCanchas : []);
        setFotos(Array.isArray(dataFotos) ? dataFotos : []);
        setServicios(Array.isArray(dataServicios) ? dataServicios : []);

      } catch (err) {
        console.error('Error al cargar el club:', err);
        setError('Error al conectar con el servidor');
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [id]);

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
    <div>
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

      <div className="encabezado-club">
        <h1 className="nombre-club">{club.nombre}</h1>
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
        <h2 className="titulo-seccion-canchas">Elegí tu turno</h2>

        {canchas.length === 0 && (
          <p className="mensaje-club">Este club todavía no cargó canchas.</p>
        )}

        {canchas.length > 0 && (
          <div className="grid-canchas-club">
            {canchas
              .filter((c) => c.estado === 'disponible')
              .map((c) => (
                <button
                  type="button"
                  key={c.id_cancha}
                  className={`tarjeta-cancha-club ${canchaSeleccionada === c.id_cancha ? 'tarjeta-cancha-club-elegida' : ''}`}
                  onClick={() => setCanchaSeleccionada(c.id_cancha)}
                >
                  <span className="tarjeta-cancha-club-nombre">{c.nombre}</span>
                  {c.tipo && <span className="tarjeta-cancha-club-tipo">{c.tipo}</span>}
                  {formatearPrecio(c.precio) && (
                    <span className="tarjeta-cancha-club-precio">{formatearPrecio(c.precio)}</span>
                  )}
                </button>
              ))}
          </div>
        )}

        {canchaSeleccionada && (
          <ReservaTurno
            club={club}
            cancha={canchas.find((c) => c.id_cancha === canchaSeleccionada)}
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

      <Footer />
    </div>
  )
}

export default Club
