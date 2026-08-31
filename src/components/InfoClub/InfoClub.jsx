import React, { useState } from 'react'
import './InfoClub.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faClock, faStar, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { iconoServicio } from '../../utils/iconoServicio'

function InfoClub({ direccion, telefono, localidad, horariosAtencion, servicios = [] }) {
    const direccionCompleta = [direccion, localidad].filter(Boolean).join(', ');

    const [abiertoUbicacion, setAbiertoUbicacion] = useState(true);
    const [abiertoHorarios, setAbiertoHorarios] = useState(true);
    const [abiertoServicios, setAbiertoServicios] = useState(true);

    return (
        <div className="tarjeta-donde-estamos-info">
            <h2 className="titulo-donde-estamos-info">Donde estamos</h2>

            <div className="donde-estamos-info-grid">

                <div className="donde-estamos-info-mapa">
                    {direccionCompleta ? (
                        <iframe
                            title="Ubicación del club"
                            className="mapa-info-iframe"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed`}
                            loading="lazy"
                        ></iframe>
                    ) : (
                        <p className="mensaje-info-club">Este club todavía no cargó su dirección.</p>
                    )}
                </div>

                <div className="donde-estamos-info-sidebar">

                    <div className="panel-info">
                        <button
                            type="button"
                            className="panel-info-header"
                            onClick={() => setAbiertoUbicacion(!abiertoUbicacion)}
                        >
                            <span><FontAwesomeIcon icon={faLocationDot} /> Ubicación</span>
                            <FontAwesomeIcon icon={abiertoUbicacion ? faChevronUp : faChevronDown} className="panel-info-flecha" />
                        </button>
                        {abiertoUbicacion && (
                            <div className="panel-info-body">
                                <p>{direccionCompleta || 'No informada'}</p>
                                {telefono && <p>{telefono}</p>}
                            </div>
                        )}
                    </div>

                    <div className="panel-info">
                        <button
                            type="button"
                            className="panel-info-header"
                            onClick={() => setAbiertoHorarios(!abiertoHorarios)}
                        >
                            <span><FontAwesomeIcon icon={faClock} /> Horarios del Club</span>
                            <FontAwesomeIcon icon={abiertoHorarios ? faChevronUp : faChevronDown} className="panel-info-flecha" />
                        </button>
                        {abiertoHorarios && (
                            <div className="panel-info-body">
                                {horariosAtencion ? (
                                    <p className="texto-horarios-info">{horariosAtencion}</p>
                                ) : (
                                    <p>Este club todavía no cargó sus horarios.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {servicios.length > 0 && (
                        <div className="panel-info">
                            <button
                                type="button"
                                className="panel-info-header"
                                onClick={() => setAbiertoServicios(!abiertoServicios)}
                            >
                                <span><FontAwesomeIcon icon={faStar} /> Servicios del Club</span>
                                <FontAwesomeIcon icon={abiertoServicios ? faChevronUp : faChevronDown} className="panel-info-flecha" />
                            </button>
                            {abiertoServicios && (
                                <div className="panel-info-body">
                                    <div className="grid-servicios-info">
                                        {servicios.map((s) => (
                                            <div key={s.id_servicio} className="item-servicio-info">
                                                <span className="icono-servicio-info"><FontAwesomeIcon icon={iconoServicio(s.nombre)} /></span>
                                                <span>{s.nombre}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}

export default InfoClub
