import React, { useState } from 'react';
import './TablaCancha.css'; // Importa el archivo de estilos CSS

const TablaCancha = () => {
  const [rowCount, setRowCount] = useState(1); // Estado para la cantidad de filas
  const [startHour, setStartHour] = useState(9); // Hora de inicio (por defecto, 9:00)
  const [endHour, setEndHour] = useState(17); // Hora de fin (por defecto, 17:00)
  const rows = Array.from({ length: rowCount }, (_, index) => index + 1); // Array de filas

  const handleRowCountChange = (e) => {
    setRowCount(parseInt(e.target.value)); // Actualiza el estado de filas
  };

  const handleStartHourChange = (e) => {
    const newStartHour = parseInt(e.target.value);
    if (newStartHour <= endHour) {
      setStartHour(newStartHour); // Actualiza la hora de inicio si es válida
    }
  };

  const handleEndHourChange = (e) => {
    const newEndHour = parseInt(e.target.value);
    if (newEndHour >= startHour) {
      setEndHour(newEndHour); // Actualiza la hora de fin si es válida
    }
  };

  // Genera un array de horas desde startHour hasta endHour
  const hours = [];
  for (let i = startHour; i <= endHour; i++) {
    hours.push(`${i}:00`);
  }

  // Estado para el estado de disponibilidad de cada celda
  const [availability, setAvailability] = useState({});

  const toggleAvailability = (rowIndex, columnIndex) => {
    const cellKey = `${rowIndex}-${columnIndex}`;
    const newAvailability = { ...availability };

    if (newAvailability[cellKey] === 'disponible') {
      newAvailability[cellKey] = 'no_disponible';
    } else {
      newAvailability[cellKey] = 'disponible';
    }

    setAvailability(newAvailability);
  };

  return (
    <div className="table-container">
      <label htmlFor="rowCountSelect">Selecciona cantidad de filas:</label>
      <select id="rowCountSelect" value={rowCount} onChange={handleRowCountChange}>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </select>

      <label htmlFor="startHourSelect">Hora de inicio:</label>
      <select id="startHourSelect" value={startHour} onChange={handleStartHourChange}>
        {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
          <option key={hour} value={hour}>
            {hour}:00
          </option>
        ))}
      </select>

      <label htmlFor="endHourSelect">Hora de fin:</label>
      <select id="endHourSelect" value={endHour} onChange={handleEndHourChange}>
        {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
          <option key={hour} value={hour} disabled={hour < startHour}>
            {hour}:00
          </option>
        ))}
      </select>

      <table>
        <thead>
          <tr>
            <th>Cancha N°</th>
            {hours.map((hour, index) => (
              <th key={index}>{hour}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rowIndex) => (
            <tr key={rowIndex}>
              <td>{rowIndex}</td>
              {hours.map((hour, columnIndex) => {
                const cellKey = `${rowIndex}-${columnIndex}`;
                return (
                  <td key={columnIndex}>
                    <button
                      className={availability[cellKey] === 'disponible' ? 'red-button' : 'green-button'}
                      onClick={() => toggleAvailability(rowIndex, columnIndex)}
                    >
                      {availability[cellKey] === 'disponible' ? 'No Disponible' : 'Disponible'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaCancha;




