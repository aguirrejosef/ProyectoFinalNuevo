import React, { useState, useEffect } from 'react';
import './ListaTablaAdmin.css'
import ClubCard from '../Card/CardAdminClub';

function ListaTablaAdmin() {
    const [clubs, setClubs] = useState([]);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await fetch('http://localhost:5000/registro/clubs'); // Reemplaza con tu ruta y método GET
          if (!response.ok) {
            throw new Error('Error al obtener los datos');
          }
          const data = await response.json();
          setClubs(data);
        } catch (error) {
          console.error('Error:', error);
        }
      };
  
      fetchData();
    }, []);
  
    return (
        <div>
            <h1 className='titulo-tabla-admin'>Lista de Clubs</h1>
            <div className='grid-listaTablaAdmin' >
            {clubs.map((club, index) => (
            < ClubCard key={index} club={club} />
            ))}
            </div>
        </div>
    );
  };

export default ListaTablaAdmin
