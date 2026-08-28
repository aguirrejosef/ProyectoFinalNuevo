import React from 'react'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import FormRegistro from '../FormRegistro/FormRegistro'
import Footer from '../Footer/Footer'

function RegistroClub() {
  return (
    <div>
        <NavBar/>
        <FormRegistro/>
        <div className="contenedor-btnFlotanteWsp">
            <BtnFlotanteWp
          NroCelular={'3814653130'}
        />
      </div>
      <Footer/> 
    </div>
  )
}

export default RegistroClub
