import React, { useState, useEffect } from 'react';
import CardCancha from '../CardCancha/CardCancha';
import './Canchas.css';

const CanchaList = ({ idClub }) => {
  const [canchas, setCanchas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const response = await fetch(`http://localhost:3000/canchas/${idClub}`);
        if (!response.ok) throw new Error('Error en la respuesta de la red');
        const data = await response.json();
        setCanchas(data);
      } catch (err) {
        console.error('Error al obtener las canchas:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCanchas();
  }, [idClub]);

  const handleReservar = (canchaId) => {
    // Aquí puedes agregar la lógica para reservar
    alert(`Reservaste la cancha ${canchaId}`);
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="cancha-list">
      {canchas.map((cancha, index) => (
        <CardCancha
          key={cancha.id}
          titulo={`Cancha ${index + 1}`}
          estado={cancha.estado} // disponible, ocupada, etc.
          onReservar={() => handleReservar(cancha.id)}
        />
      ))}
    </div>
  );
};

export default CanchaList;
