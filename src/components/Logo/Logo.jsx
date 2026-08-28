import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../Logo/Logo.css'

function Logo() {

    const navigate = useNavigate();

  return (
    <div>
      <div className="contenedor-img-logo" onClick={() => navigate("/")}></div>
    </div>
  )
}

export default Logo
