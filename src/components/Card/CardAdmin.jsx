import React from 'react';
import './CardAdmin.css'; // Importa tu archivo CSS

const CardAdmin = ({ datos }) => {
  const handleClick = () => {
    alert("Historial de reservas");
    // Aquí podrías manejar más lógica relacionada con el historial de reservas
  };

  return (
    <div className="card-admin">
      <img src={datos.imagen} alt={datos.nombre} className="card-img-top" />
      <div className="card-body">
        <h5 className="card-title">{datos.nombre}</h5>
        <p className="card-text">{datos.correo}</p>
        <div className="cnt-card-admin-btn">
          <button className='card-admin-btn' onClick={handleClick}>Ver historial</button>
        </div>
      </div>
    </div>
  );
};

export default CardAdmin;


