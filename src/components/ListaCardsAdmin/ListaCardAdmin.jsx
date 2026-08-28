import React, { useEffect, useState } from 'react';
import CardAdmin from '../Card/CardAdmin';
import './ListaCardAdmin.css'

const ListaCardsAdmin = () => {
  const [datos, setDatos] = useState([]);

  useEffect(() => {
    // Aquí realizarías la petición GET a tu base de datos MongoDB
    // Por ejemplo, usando fetch o axios
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:3000/registro/users'); // Reemplaza con tu ruta y método GET
        if (!response.ok) {
          throw new Error('Error al obtener los datos');
        }
        const data = await response.json();
        setDatos(data); // Aquí asumes que data es un array de objetos con la estructura { imagen, nombre, correo }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
        <h1 className="titulo-card-admin">Lista de usuarios</h1>
        <div className="lista-cards-admin">    
        {datos.map((item, index) => (
            <CardAdmin key={index} datos={item} />
        ))}
        </div>
    </div>
  );
};

export default ListaCardsAdmin;
