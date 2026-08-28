import React from 'react'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import"./Usuarios.css"
import Usuarios from '../CardsUsuarios/CardsUsuarios'

function Usuario() {
  return (
    <div className="usuario-pagina">
        <NavBar/>
        <main className="usuario-contenido">
          <Usuarios/>
        </main>
        <Footer/>
    </div>
  )
}

export default Usuario