import React from 'react'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import FormUsuarios from '../FormRegistro/FormUsuarios';
import Footer from '../Footer/Footer'

function RegistroUsuario() {
  return (
    <div>
        <NavBar/>
      <FormUsuarios />
      <div className="contenedor-btnFlotanteWsp">
            <BtnFlotanteWp
          NroCelular={'3814653130'}
        />
      </div>
      <Footer/> 
    </div>
  );
}

export default RegistroUsuario;
