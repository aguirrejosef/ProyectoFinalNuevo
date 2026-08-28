import React from 'react'
import './Card.css'
import { useNavigate } from 'react-router-dom'

function Card({ imagen, titulo, id, direccion, localidad, cantidadCanchas, precioDesde }) {

  const navigate = useNavigate();

  const formatearPrecio = (precio) => {
    if (precio === null || precio === undefined) return 'Precio a consultar';
    const numero = Number(precio);
    return `Desde $${numero.toLocaleString('es-AR')}`;
  };

  return (

      <div className="card">
        <img src={imagen} alt={titulo} className="card-img" />
        <div className="card-contenido">
          <h2 className="card-titulo">{titulo}</h2>
          <div className='card-descripcion'>
            <p className="card-detalle">📍 Dirección: {direccion}</p>
            <p className="card-detalle">🏙️ Localidad: {localidad}</p>
            <p className="card-detalle">
              🎾 {cantidadCanchas || 0} cancha{Number(cantidadCanchas) === 1 ? '' : 's'}
            </p>
            <p className="card-detalle card-precio">{formatearPrecio(precioDesde)}</p>
          </div>
          <button className='btn-club' onClick={() => navigate(`/canchas/${id}`)}>Ver más</button>
        </div>
      </div>
  );
}



export default Card