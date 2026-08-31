import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import InfoClub from '../InfoClub/InfoClub'
import ReservaTurno from '../ReservaTurno/ReservaTurno'
import { apiFetch } from '../../api'
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

      <h1 className="nombre-club">{club.nombre}</h1>

      {fotos.length > 0 && (
        <div className="galeria-club">
          {fotos.map((f) => (
            <img key={f.id_foto} src={f.url} alt={club.nombre} className="galeria-club-img" />
          ))}
        </div>
      )}

      <div className="seccion-canchas-club">
        <h2 className="titulo-seccion-canchas">Elegí tu cancha y tu turno</h2>

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
