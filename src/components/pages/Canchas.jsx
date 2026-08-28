import React from 'react'
import NavBar from '../NavBar/NavBar'
import Footer from '../Footer/Footer'
import"./Canchas.css"
import ClubList from '../CardsClubes/CardsClubes'

function Canchas() {
  return (
    <div>
        <NavBar/>
        <h1 className="titulo-canchas">Listado de clubes:</h1>
        <ClubList/>
        <Footer/>
    </div>
  )
}

export default Canchas