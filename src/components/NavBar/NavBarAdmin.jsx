import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../NavBar/NavBar.css'
import Logo from '../Logo/Logo';

function NavBarAdmin() {

  const navigate = useNavigate();

  return (
    <div className='contenedor'>
      <div className='contenedor-grid'>
        <div className="grid-item1">
            <div className="contenedor-img-nav">
              <Logo/>
            </div>
        </div>
        <div className="grid-item2"></div>
        <div className="grid-item3"></div>
        <div className="grid-item4">
            {/*<button className='btn-iniciarSesion' id='btn-navbar' onClick={() => navigate("/login")}>Iniciar Sesión</button>*/}
        </div>
      </div>
    </div>
  )
}

export default NavBarAdmin