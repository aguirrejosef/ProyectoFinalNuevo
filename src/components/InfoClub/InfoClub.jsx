import React from 'react'
import './InfoClub.css'

function InfoClub({ direccion, telefono, localidad, horariosAtencion, servicios = [] }) {
  const direccionCompleta = [direccion, localidad].filter(Boolean).join(', ');

  return (
    <div className='contenedor-infoclub'>
        <div className="columna-infoclub1">
            <div className='contenedor-flex-map'>
                <h2 className="titulo-map">Nos encontramos en:</h2>
                <div className="contenedor-map">
                    {direccionCompleta ? (
                        <iframe
                            src={`https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed`}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Mapa de ubicación del club"
                        >
                        </iframe>
                    ) : (
                        <p className="descripcion-info-club">Este club todavía no cargó su dirección.</p>
                    )}
                </div>
            </div>
        </div>
        <div className="columna-infoclub2">
            <div className="info-club">
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Dirección:</h3>
                    <p className="descripcion-info-club">{direccionCompleta || 'No informada'}</p>
                </div>
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Telefono:</h3>
                    <p className="descripcion-info-club">{telefono || 'No informado'}</p>
                </div>
                <div className="grupo-info">
                    <h3 className="titulo-info-club">Horarios del club</h3>
                    {horariosAtencion ? (
                        <p className="descripcion-info-club texto-horarios-club" id='horario'>{horariosAtencion}</p>
                    ) : (
                        <p className="descripcion-info-club" id='horario'>Este club todavía no cargó sus horarios.</p>
                    )}
                </div>
                {servicios.length > 0 && (
                    <div className="grupo-info">
                        <h3 className="titulo-info-club">Servicios adicionales</h3>
                        <div className="servicios-adicionales-infoclub">
                            {servicios.map((s) => (
                                <span key={s.id_servicio} className="servicio-adicional-tag">{s.nombre}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

    </div>
  )
}

export default InfoClub
