import React, { useState, useEffect } from 'react';
import './CardsClubes.css';
import Card from '../Card/Card';
import { apiFetch } from '../../api';

const ClubList = () => {
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [favoritos, setFavoritos] = useState(new Set());
  const [soloFavoritos, setSoloFavoritos] = useState(false);

  const esCliente = Number(localStorage.getItem('rol')) === 3;

  useEffect(() => {
    const fetchClubes = async () => {
      try {
        const response = await apiFetch('/clubes');
        if (!response.ok) {
          throw new Error('Error en la respuesta de la red');
        }
        const data = await response.json();
        setClubes(data);
      } catch (error) {
        console.error('Error al obtener los clubes:', error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubes();
  }, []);

  useEffect(() => {
    if (!esCliente) return;
    const fetchFavoritos = async () => {
      try {
        const response = await apiFetch('/mis-favoritos');
        if (!response.ok) return;
        const data = await response.json();
        setFavoritos(new Set(Array.isArray(data) ? data : []));
      } catch (error) {
        console.error('Error al obtener los favoritos:', error);
      }
    };
    fetchFavoritos();
  }, [esCliente]);

  const handleToggleFavorito = async (idClub, nuevoValor) => {
    // Optimista: se ve el cambio al toque, y se revierte solo si falla el pedido.
    setFavoritos((prev) => {
      const copia = new Set(prev);
      if (nuevoValor) copia.add(idClub); else copia.delete(idClub);
      return copia;
    });
    try {
      const response = await apiFetch(`/clubes/${idClub}/favorito`, { method: nuevoValor ? 'POST' : 'DELETE' });
      if (!response.ok) throw new Error('No se pudo actualizar favoritos');
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
      setFavoritos((prev) => {
        const copia = new Set(prev);
        if (nuevoValor) copia.delete(idClub); else copia.add(idClub);
        return copia;
      });
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (error) {
    return <div>Error al obtener los datos: {error.message}</div>;
  }

  const texto = busqueda.trim().toLowerCase();
  let clubesFiltrados = texto
    ? clubes.filter((club) =>
        club.nombre?.toLowerCase().includes(texto) ||
        club.localidad?.toLowerCase().includes(texto) ||
        club.provincia?.toLowerCase().includes(texto)
      )
    : clubes;
  if (esCliente && soloFavoritos) {
    clubesFiltrados = clubesFiltrados.filter((club) => favoritos.has(club.id_club));
  }

  return (
    <div className="club-list-contenedor">
      <div className="club-list-buscador">
        <input
          type="text"
          placeholder="Buscar por nombre o localidad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {esCliente && (
          <label className="club-list-check-favoritos">
            <input
              type="checkbox"
              checked={soloFavoritos}
              onChange={(e) => setSoloFavoritos(e.target.checked)}
            />
            Solo favoritos
          </label>
        )}
      </div>

      {clubesFiltrados.length === 0 ? (
        <p className="club-list-sin-resultados">
          {soloFavoritos ? 'Todavía no marcaste ningún club como favorito.' : `No encontramos ningún club con "${busqueda}".`}
        </p>
      ) : (
        <div className="club-list">
          {clubesFiltrados.map((club) => (
            <Card
              key={club.id_club}
              id={club.id_club}
              imagen={club.foto_dueno || '/imagenes/padel.jpg'}
              titulo={club.nombre}
              direccion={club.direccion}
              localidad={club.localidad}
              telefono={club.telefono}
              cantidadCanchas={club.cantidad_canchas}
              precioDesde={club.precio_desde}
              promedioResenas={club.promedio_resenas}
              esFavorito={favoritos.has(club.id_club)}
              onToggleFavorito={esCliente ? handleToggleFavorito : undefined}
              cantidadResenas={club.cantidad_resenas}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClubList;