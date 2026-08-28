import React from 'react'
import'./InfoClub.css'

function InfoClub({direccion,telefono}) {
  return (
    <div className='contenedor-infoclub'>
        <div className="columna-infoclub1">
            <div className='contenedor-flex-map'>
                <h2 className="titulo-map">Nos encontramos en:</h2>
                <div className="contenedor-map">
                    <iframe 
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3560.7851753118503!2d-65.21077832378374!3d-26.814968089128314!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94225c3bd94ffffd%3A0xe3a98eff29fcd099!2sItalia%20Padel!5e0!3m2!1ses!2sar!4v1719110870705!5m2!1ses!2sar" 
                        width="1000" 
                        height="600" 
                        style={{ border: 0 }} 
                        allowFullScreen="" 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Mapa de ubicación del club"
                        >
                    </iframe>
                </div>
            </div>
        </div>
        <div className="columna-infoclub2">
            <div className="info-club">
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Dirección:</h3>
                    <p className="descripcion-info-club">{direccion}</p>
                </div>
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Telefono:</h3>
                    <p className="descripcion-info-club">{telefono}</p>
                </div> 
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Horarios del club</h3>
                    <p className="descripcion-info-club" id='horario'>Lunes a viernes: </p>
                    <p className="descripcion-info-club" id='horario'>Sabados: </p>
                    <p className="descripcion-info-club" id='horario'>Domingos: </p>
                </div>                
            </div>
        </div>
      
    </div>
  )
}

export default InfoClub
