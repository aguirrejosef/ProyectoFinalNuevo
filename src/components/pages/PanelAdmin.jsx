import React, { useState } from 'react';
import ListaTablaAdmin from '../ListaTablaAdmin/ListaTablaAdmin';
import CardsUsuarios from '../CardsUsuarios/CardsUsuarios';
import AdminResumen from '../AdminResumen/AdminResumen';
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp';
import Footer from '../Footer/Footer';
import NavBar from '../NavBar/NavBar';

function PanelAdmin() {
  const [mostrarTabla, setMostrarTabla] = useState(true);
  const [refrescarResumen, setRefrescarResumen] = useState(0);

  const dispararRefrescoResumen = () => setRefrescarResumen((r) => r + 1);

  return (
    <div>
        <NavBar/>
        <AdminResumen mostrandoClubes={mostrarTabla} refrescar={refrescarResumen} />
      <div className="botones-alternancia">
        <button
          className={`nav-btn ${mostrarTabla ? 'nav-btn-activo' : ''}`}
          onClick={() => setMostrarTabla(true)}
        >
          Mostrar Clubes
        </button>
        <button
          className={`nav-btn ${!mostrarTabla ? 'nav-btn-activo' : ''}`}
          onClick={() => setMostrarTabla(false)}
        >
          Mostrar Usuarios
        </button>
        </div>
        {mostrarTabla
          ? <ListaTablaAdmin onCambioEstado={dispararRefrescoResumen} />
          : <CardsUsuarios onCambioEstado={dispararRefrescoResumen} />}
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
