import React, { useState, useEffect } from 'react'
import './Cards.css'
import Card from '../Card/Card'

function Cards() {
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClubesPopulares = async () => {
      try {
        const response = await fetch('http://localhost:3000/clubes/populares?limit=3');
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

  // Misma lógica de imagen por defecto que en el Listado de Clubes
  const imagenPorClub = (nombre) => {
    if (nombre === 'Italia Padel') return '/imagenes/cards/ITALIA PADEL.jpg';
    if (nombre === 'Mad Padel') return '/imagenes/cards/MAD PADEL.jpg';
    if (nombre === 'Alemania Padel') return '/imagenes/cards/ALEMANIAPADEL.jpg';
    return '/imagenes/cards/ITALIA PADEL.jpg';
  };

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
            imagen={imagenPorClub(club.nombre)}
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