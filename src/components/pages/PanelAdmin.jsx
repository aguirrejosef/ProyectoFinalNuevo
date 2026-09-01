import React, { useState } from 'react';
import ListaTablaAdmin from '../ListaTablaAdmin/ListaTablaAdmin';
import CardsUsuarios from '../CardsUsuarios/CardsUsuarios';
import AdminResumen from '../AdminResumen/AdminResumen';
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp';
import Footer from '../Footer/Footer';
import NavBar from '../NavBar/NavBar';

function PanelAdmin() {
  const [mostrarTabla, setMostrarTabla] = useState(true);

  return (
    <div>
        <NavBar/>
        <AdminResumen />
      <div className="botones-alternancia">
        <button onClick={() => setMostrarTabla(true)}>Mostrar Clubes</button>
        <button onClick={() => setMostrarTabla(false)}>Mostrar Usuarios</button>
        </div>
        {mostrarTabla ? <ListaTablaAdmin /> : <CardsUsuarios />}
        <Footer />
        <div className="contenedor-btnFlotanteWsp">
            <BtnFlotanteWp
                NroCelular={'3814653130'}
            />
        </div>
    </div>
  );
}

export default PanelAdmin;
