import React, { useState, useEffect } from 'react'
import './Cards.css'
import Card from '../Card/Card'
import { apiFetch } from '../../api'

function Cards() {
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favoritos, setFavoritos] = useState(new Set());

  const esCliente = Number(localStorage.getItem('rol')) === 3;

  useEffect(() => {
    const fetchClubesPopulares = async () => {
      try {
        const response = await apiFetch('/clubes/populares?limit=3');
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
          setError(true);
          return;
        }
        setClubes(data);
      } catch (error) {
        console.error('Error al obtener los clubes populares:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchClubesPopulares();
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
    return <div className="cards-cargando">Cargando clubes...</div>;
  }

  if (error) {
    return <p className="cards-vacio">No se pudieron cargar los clubes. Intentá de nuevo más tarde.</p>;
  }

  if (clubes.length === 0) {
    return <p className="cards-vacio">Todavía no hay clubes registrados en la plataforma.</p>;
  }

  return (
    <div className="contenedor-grid-cards">
      {clubes.map((club) => (
        <div className="grid-item-card" key={club.id_club}>
          <Card
            imagen={club.foto_dueno || '/imagenes/padel.jpg'}
            titulo={club.nombre}
            id={club.id_club}
            direccion={club.direccion}
            localidad={club.localidad}
            cantidadCanchas={club.cantidad_canchas}
            precioDesde={club.precio_desde}
            promedioResenas={club.promedio_resenas}
            cantidadResenas={club.cantidad_resenas}
            esFavorito={favoritos.has(club.id_club)}
            onToggleFavorito={esCliente ? handleToggleFavorito : undefined}
          />
        </div>
      ))}
    </div>
  )
}

export default Cards