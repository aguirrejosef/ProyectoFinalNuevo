import React from 'react'
import { useNavigate } from 'react-router-dom'
import "./Footer.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faInstagram, faTwitter } from '@fortawesome/free-brands-svg-icons'

function Footer() {

    const navigate = useNavigate();

    const abrirFacebook = () => {
        const facebookLink = 'https://www.facebook.com/';
        window.open(facebookLink, '_blank');
    };
    const abrirTwitter = () => {
        const twitterLink = 'https://www.x.com/';
        window.open(twitterLink, '_blank');
    };
    const abrirInstagram = () => {
        const instagramLink = 'https://www.instagram.com/';
        window.open(instagramLink, '_blank');
      };




  return (
    <div className='contenedor-footer'>
      <div className='grid-footer'>
        <div className="grid-item-footer" id='item1-footer'>
            <div className='logo-footer'>
                <img src='/imagenes/logoBlanco.png' alt="" id='img-footer'/>
            </div>
        </div>
        <div className="grid-item-footer" id='item2-footer'>
            <h3 className="redes" id='titulo-redes'>Siguenos en nuestras redes:</h3>
            <div className="redes-footer">
                <div className="red1-footer" onClick={abrirFacebook}>
                    <FontAwesomeIcon icon={faFacebook} style={{width: '45px', height:'45px', color:'white', cursor:'pointer'}}/>
                </div>
                <div className="red2-footer" onClick={abrirTwitter}>
                    <FontAwesomeIcon icon={faTwitter} style={{width: '45px', height:'45px', color:'white', cursor:'pointer'}}/>
                </div>
                <div className="red3-footer" onClick={abrirInstagram}>
                    <FontAwesomeIcon icon={faInstagram} style={{width: '45px', height:'45px', color:'white', cursor:'pointer'}}/>
                </div>
            </div>
        </div>
        <div className="grid-item-footer" id='item3-footer'>
            <p className="link-planes-footer" onClick={() => navigate('/planes')}>
                ¿Tenés un club? Conocé nuestros planes
            </p>
            <p>Politicas de privacidad | Informacion Legal</p>
            <p>Copyright 2024 SaleUnPadel.Inc</p>
        </div>
      </div>
    </div>
  )
}

export default Footer