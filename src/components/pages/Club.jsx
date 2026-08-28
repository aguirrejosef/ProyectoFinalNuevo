import React from 'react'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import InfoClub from '../InfoClub/InfoClub'
import "./Club.css"
import TablaCancha from '../TablaCanchas/TablaCachas'

function Club({nombreClub,direccion,telefono}) {
  return (
    <div>
        <NavBar/>
        <h1 className="nombre-club">
          {nombreClub}
        </h1>
       <div>
          <h1>Elegi tu turno</h1>
          <TablaCancha/>
        </div>
        <InfoClub
        direccion={direccion}
        telefono={telefono}/>
        <Footer/>
    </div>
  )
}

export default Club
