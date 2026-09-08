import React, { useState, useEffect } from 'react'
import './Cards.css'
import Card from '../Card/Card'
import { apiFetch } from '../../api'

function Cards() {
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClubesPopulares = async () => {
      try {
        const response = await apiFetch('/clubes/populares?limit=3');
        const data = await response.json();
        setClubes(data);
      } catch (error) {
        console.error('Error al obtener los clubes populares:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubesPopulares();
  }, []);

  if (loading) {
    return <div className="cards-cargando">Cargando clubes...</div>;
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
          />
        </div>
      ))}
    </div>
  )
}

export default Cards