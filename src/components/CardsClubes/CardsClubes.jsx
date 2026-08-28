import React, { useState, useEffect } from 'react';
import './CardsClubes.css';
import Card from '../Card/Card';
import { apiFetch } from '../../api';

const ClubList = () => {
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (error) {
    return <div>Error al obtener los datos: {error.message}</div>;
  }

 return (
    <div className="club-list">
      {clubes.map((club) => {
        // Aquí puedes asignar la imagen de acuerdo a alguna propiedad del club
        let imagen = '/imagenes/cards/ITALIA PADEL.jpg'; // Valor por defecto (puedes cambiarlo si es necesario)

        // Asigna la imagen correcta según el nombre del club
        if (club.nombre === 'Italia Padel') {
          imagen = '/imagenes/cards/ITALIA PADEL.jpg'; // Imagen para ITALIA PADEL
        } else if (club.nombre === 'Mad Padel') {
          imagen = '/imagenes/cards/MAD PADEL.jpg'; // Imagen para MAD PADEL
        } else if (club.nombre === 'Alemania Padel') {
          imagen = '/imagenes/cards/ALEMANIAPADEL.jpg'; // Imagen para ALEMANIA PADEL
        }

        return (
          <Card
            key={club.id_club}
            id={club.id_club}
            imagen={imagen}
            titulo={club.nombre}
            direccion={club.direccion}
            localidad={club.localidad}
            telefono={club.telefono}
            cantidadCanchas={club.cantidad_canchas}
            precioDesde={club.precio_desde}
          />
        );
      })}
    </div>
  );
};

export default ClubList;