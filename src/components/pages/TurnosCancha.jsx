import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import './TurnosCancha.css';
import { apiFetch } from '../../api';

const NOMBRES_ESTADO = {
    reservado: 'Reservado',
    completado: 'Completado',
    cancelado: 'Cancelado',
    pendiente_pago: 'Pendiente de pago'
};

function TurnosCancha() {
    const { idCancha } = useParams();
    const navigate = useNavigate();
 
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
 
    useEffect(() => {
        const cargarTurnos = async () => {
            try {
                const res = await apiFetch(`/club/turnos-cancha?id_cancha=${idCancha}`);
                const data = await res.json();
 
                if (!res.ok) {
                    setError(data.message || 'Error al cargar los turnos');
                    return;
                }
 
                setTurnos(data);
 
            } catch (err) {
                console.error('Error al cargar turnos de la cancha:', err);
                setError('Error al conectar con el servidor');
            } finally {
                setLoading(false);
            }
        };
 
        cargarTurnos();
    }, [idCancha]);
 
    const formatearFecha = (fecha) => {
        const f = new Date(fecha);
        return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
 
    const formatearHora = (hora) => hora ? hora.slice(0, 5) : '';
 
    return (
        <>
            <NavBar />
 
            <div className="contenedor-turnos-cancha">
 
                <button type="button" className="btn-volver-canchas" onClick={() => navigate('/mis-canchas')}>
                    ← Volver a Mis Canchas
                </button>
 
                <h2 className="titulo-turnos-cancha">Turnos de esta cancha</h2>
 
                {loading && <p className="mensaje-turnos-cancha">Cargando turnos...</p>}
                {error && <p className="mensaje-turnos-cancha error-turnos-cancha">{error}</p>}
 
                {!loading && !error && turnos.length === 0 && (
                    <p className="mensaje-turnos-cancha">Esta cancha todavía no tiene turnos reservados.</p>
                )}
 
                {!loading && !error && turnos.length > 0 && (
                    <div className="tabla-turnos-cancha">
                        <div className="fila-turnos-cancha fila-header">
                            <span>Fecha</span>
                            <span>Horario</span>
                            <span>Cliente</span>
                            <span>Teléfono</span>
                            <span>Estado</span>
                        </div>
 
                        {turnos.map((t) => (
                            <div key={t.id_turno} className="fila-turnos-cancha">
                                <span>{formatearFecha(t.fecha)}</span>
                                <span>{formatearHora(t.hora_inicio)} a {formatearHora(t.hora_fin)}</span>
                                <span>{t.cliente_nombre} {t.cliente_apellido}</span>
                                <span>{t.cliente_telefono || '-'}</span>
                                <span className={`estado-turno-cancha estado-${t.estado?.toLowerCase()}`}>
                                    {NOMBRES_ESTADO[t.estado] || t.estado}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
 
            </div>
 
            <Footer />
        </>
    );
}
 
export default TurnosCancha;