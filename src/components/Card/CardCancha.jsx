import React from 'react';
import './CardCancha.css';

const CardCancha = ({ titulo, estado, onReservar }) => {
  return (
    <div className="card-cancha">
      <h3 className="titulo-cancha">{titulo}</h3>
      <p className={`estado-cancha ${estado}`}>Estado: {estado}</p>
      <button className="btn-reservar" onClick={onReservar} disabled={estado !== 'disponible'}>
        Reservar
      </button>
    </div>
  );
};

export default CardCancha;
