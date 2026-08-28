import React from 'react'
import './BtnFlotanteWp.css'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faWhatsapp} from '@fortawesome/free-brands-svg-icons'


function BtnFlotanteWp({NroCelular}) {

    const abrirWhatsapp = () => {
        const whatsappLink = `https://api.whatsapp.com/send?phone=54${NroCelular}`;
        window.open(whatsappLink, '_blank');
      };

  return (
    <div className="contenedor-btn-wsp" onClick={abrirWhatsapp}>
        <FontAwesomeIcon icon={faWhatsapp} style={{width: '60px', height:'60px', color:'white'}}/>
    </div>
  )
}

export default BtnFlotanteWp