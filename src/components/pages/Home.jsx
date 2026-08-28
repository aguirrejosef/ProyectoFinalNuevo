import React from 'react'
import '../pages/Home.css'
import NavBar from '../NavBar/NavBar'
import Slider from '../Slider/Slider'
import Titulo from '../Titulo/Titulo'
import Cards from '../Cards/Cards'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import PanelClub from '../PanelClub/PanelClub'
import { useNavigate } from 'react-router-dom'

function Home() {

  const navigate = useNavigate();
  const rol = localStorage.getItem('rol');

  // El dueño de un club no ve la landing de venta: ve el resumen de su negocio
  if (Number(rol) === 2) {
    return (
      <div className="home-pagina">
        <NavBar/>
        <main className="home-contenido">
          <PanelClub/>
        </main>
        <Footer/>
      </div>
    );
  }

  return (
    <div className="home-pagina">
      <NavBar/>
      <main className="home-contenido">
        <Slider/>

        <Titulo
          title={'Clubes mas visitados'}
        />
        <Cards/>
        <div className="ver-canchas">
          <button className='btn-ver-canchas' onClick={() => navigate("/canchas")}>Ver todas los clubes</button>
        </div>
        <div className="contenedor-btnFlotanteWsp">
          <BtnFlotanteWp
            NroCelular={'3814653130'}
          />
        </div>
      </main>
      <Footer/>
    </div>
  )
}

export default Home