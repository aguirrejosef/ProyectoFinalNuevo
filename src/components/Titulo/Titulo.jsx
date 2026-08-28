import React from 'react'
import './Titulo.css'

function Titulo({title}) {
  return (
    <div className='contenedor-titulo'>
        <h1 className='titulo'>{title}</h1>
      
    </div>
  )
}

export default Titulo