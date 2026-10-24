import React from 'react'
import './Card.css'
import { useNavigate } from 'react-router-dom'

function Card({ imagen, titulo, id, direccion, localidad, cantidadCanchas, precioDesde, promedioResenas, cantidadResenas }) {

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
          {cantidadResenas > 0 && (
            <p className="card-rating">
              <span className="card-rating-estrella">★</span> {promedioResenas} <span className="card-rating-cantidad">({cantidadResenas})</span>
            </p>
          )}
          <div className='card-descripcion'>
            <p className="card-detalle">
              <span className="card-detalle-icono">📍</span>
              <span>Dirección: {direccion}</span>
            </p>
            <p className="card-detalle">
              <span className="card-detalle-icono">🏙️</span>
              <span>Localidad: {localidad}</span>
            </p>
            <p className="card-detalle">
              <span className="card-detalle-icono">🎾</span>
              <span>{cantidadCanchas || 0} cancha{Number(cantidadCanchas) === 1 ? '' : 's'}</span>
            </p>
            <p className="card-detalle card-precio">{formatearPrecio(precioDesde)}</p>
          </div>
          <button className='btn-club' onClick={() => navigate(`/canchas/${id}`)}>Ver más</button>
        </div>
      </div>
  );
}



export default Card