import React, { useState, useEffect } from 'react';
import './ListaTablaAdmin.css'
import ClubCard from '../Card/CardAdminClub';
import { apiFetch } from '../../api';

function ListaTablaAdmin() {
    const [clubs, setClubs] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await apiFetch('/admin/clubes');
          if (!response.ok) {
            throw new Error('Error al obtener los datos');
          }
          const data = await response.json();
          setClubs(data);
        } catch (error) {
          console.error('Error:', error);
        } finally {
          setCargando(false);
        }
      };

      fetchData();
    }, []);

    const handleEliminado = (idClub) => {
      setClubs((actuales) => actuales.filter((c) => c.id_club !== idClub));
    };

    return (
        <div>
            <h1 className='titulo-tabla-admin'>Lista de Clubs</h1>
            {cargando && <p>Cargando...</p>}
            {!cargando && clubs.length === 0 && <p>Todavía no hay clubes registrados.</p>}
            <div className='grid-listaTablaAdmin' >
            {clubs.map((club) => (
              <ClubCard key={club.id_club} club={club} onEliminado={handleEliminado} />
            ))}
            </div>
        </div>
    );
  };

export default ListaTablaAdmin
