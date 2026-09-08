import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import './MisTurnos.css';
import { apiFetch } from '../../api';
 
const TABS = [
    { key: 'reservado', label: 'Reservadas' },
    { key: 'completado', label: 'Completadas' },
    { key: 'cancelado', label: 'Canceladas' }
];
 
const MENSAJES_VACIO = {
    reservado: {
        titulo: 'No tenés reservas activas',
        texto: 'Cuando realices una reserva, vas a poder revisarla aquí.'
    },
    completado: {
        titulo: 'No tenés reservas completadas',
        texto: 'Acá vas a ver el historial de tus turnos ya jugados.'
    },
    cancelado: {
        titulo: 'No tenés reservas canceladas',
        texto: 'Acá vas a ver los turnos que hayas cancelado.'
    }
};
 
function IconoVacio() {
    return (
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="12" width="50" height="66" rx="8" stroke="#004AAD" strokeWidth="3" />
            <path d="M35 12 C35 8 39 5 45 5 C51 5 55 8 55 12" stroke="#004AAD" strokeWidth="3" fill="none" />
            <circle cx="37" cy="55" r="1.8" fill="#004AAD" />
            <circle cx="53" cy="55" r="1.8" fill="#004AAD" />
            <path d="M35 65 Q45 60 55 65" stroke="#004AAD" strokeWidth="3" fill="none" strokeLinecap="round" />
            <text x="60" y="32" fontSize="15" fill="#004AAD" fontWeight="bold">Z</text>
            <text x="69" y="22" fontSize="11" fill="#004AAD" fontWeight="bold">z</text>
        </svg>
    );
}
 
function MisTurnos() {
    const navigate = useNavigate();
 
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tabActiva, setTabActiva] = useState('reservado');
    const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
    const [cancelando, setCancelando] = useState(false);
 
    useEffect(() => {
        const idUsuario = localStorage.getItem('id');
        const rol = localStorage.getItem('rol');
 
        if (!rol || !idUsuario) {
            navigate('/login');
            return;
        }
 
        const cargarTurnos = async () => {
            try {
                const res = await apiFetch(
                    `/turnos?id_usuario=${idUsuario}`
                );
 
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.message || 'Error al cargar turnos');
                    return;
                }
 
                const data = await res.json();
 
                const turnosOrdenados = [...data].sort(
                    (a, b) => new Date(a.fecha) - new Date(b.fecha)
                );
 
                setTurnos(turnosOrdenados);
 
            } catch (err) {
                console.error('Error al cargar turnos:', err);
                setError('Error al conectar con el servidor');
            } finally {
                setLoading(false);
            }
        };
 
        cargarTurnos();
    }, [navigate]);
 
    const formatearFecha = (fecha) => {
        const f = new Date(fecha);
        return f.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };
 
    const formatearHora = (hora) => hora ? hora.slice(0, 5) : '';
 
    const turnosFiltrados = turnos.filter(
        (t) => t.estado?.toLowerCase() === tabActiva
    );
 
    const handleCambiarTab = (tab) => {
        setTabActiva(tab);
        setTurnoSeleccionado(null);
    };

    const handleCancelarTurno = async () => {
        if (!turnoSeleccionado) return;

        const confirmar = window.confirm('¿Seguro que querés cancelar este turno?');
        if (!confirmar) return;

        setCancelando(true);

        try {
            const res = await apiFetch(`/turnos/${turnoSeleccionado.id_turno}/cancelar`, {
                method: 'PUT'
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || 'No se pudo cancelar el turno');
                return;
            }

            setTurnos((prev) => prev.map((t) =>
                t.id_turno === turnoSeleccionado.id_turno ? { ...t, estado: 'cancelado' } : t
            ));
            setTurnoSeleccionado(null);

        } catch (err) {
            console.error('Error al cancelar turno:', err);
            alert('Error al conectar con el servidor');
        } finally {
            setCancelando(false);
        }
    };
 
    return (
        <>
            <NavBar />
 
            <div className="contenedor-turnos">
 
                <div className="panel-turnos">

                    <div className="fila-titulo-panel">
                        <h2 className="titulo-panel">Mis Reservas</h2>
                        <button type="button" className="btn-nueva-reserva" onClick={() => navigate('/canchas')}>
                            + Reservar turno
                        </button>
                    </div>

                    <div className="tabs-turnos">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`tab-turno ${tabActiva === tab.key ? 'tab-activa' : ''}`}
                                onClick={() => handleCambiarTab(tab.key)}
                            >
                                {tab.label.toUpperCase()}
                            </button>
                        ))}
                    </div>
 
                    {loading && <p className="mensaje-turnos">Cargando turnos...</p>}
                    {error && <p className="mensaje-turnos error-turnos">{error}</p>}
 
                    {!loading && !error && turnosFiltrados.length === 0 && (
                        <div className="vacio-turnos">
                            <IconoVacio />
                            <p className="vacio-titulo">{MENSAJES_VACIO[tabActiva].titulo}</p>
                            <p className="vacio-texto">{MENSAJES_VACIO[tabActiva].texto}</p>
                        </div>
                    )}
 
                    {!loading && !error && turnosFiltrados.length > 0 && (
                        <div className="lista-turnos">
                            {turnosFiltrados.map((turno) => (
                                <div
                                    key={turno.id_turno}
                                    className={`tarjeta-turno ${turnoSeleccionado?.id_turno === turno.id_turno ? 'tarjeta-seleccionada' : ''}`}
                                    onClick={() => setTurnoSeleccionado(turno)}
                                >
                                    <div className="fila-turno-header">
                                        <span className="fecha-turno">
                                            {formatearFecha(turno.fecha)}
                                        </span>
                                        <span className={`estado-turno estado-${turno.estado?.toLowerCase()}`}>
                                            {turno.estado}
                                        </span>
                                    </div>
 
                                    <div className="fila-turno-detalle">
                                        <span>🎾 {turno.cancha} — {turno.club}</span>
                                    </div>
 
                                    <div className="fila-turno-detalle">
                                        <span>🕐 {formatearHora(turno.hora_inicio)} a {formatearHora(turno.hora_fin)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
 
                </div>
 
                <div className="panel-detalle">
 
                    <h2 className="titulo-panel">Detalle de reserva</h2>
 
                    {!turnoSeleccionado && (
                        <div className="detalle-vacio">
                            <div className="detalle-placeholder">
                                <div className="placeholder-cuadro"></div>
                                <div className="placeholder-lineas">
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                            <p className="detalle-vacio-texto">Selecciona una reserva para ver el detalle</p>
                        </div>
                    )}
 
                    {turnoSeleccionado && (
                        <div className="detalle-contenido">
 
                            <div className="detalle-fila">
                                <span className="detalle-etiqueta">Estado</span>
                                <span className={`estado-turno estado-${turnoSeleccionado.estado?.toLowerCase()}`}>
                                    {turnoSeleccionado.estado}
                                </span>
                            </div>
 
                            <div className="detalle-fila">
                                <span className="detalle-etiqueta">Fecha</span>
                                <span>{formatearFecha(turnoSeleccionado.fecha)}</span>
                            </div>
 
                            <div className="detalle-fila">
                                <span className="detalle-etiqueta">Horario</span>
                                <span>{formatearHora(turnoSeleccionado.hora_inicio)} a {formatearHora(turnoSeleccionado.hora_fin)}</span>
                            </div>
 
                            <div className="detalle-fila">
                                <span className="detalle-etiqueta">Cancha</span>
                                <span>{turnoSeleccionado.cancha}</span>
                            </div>
 
                            <div className="detalle-fila">
                                <span className="detalle-etiqueta">Club</span>
                                <span>{turnoSeleccionado.club}</span>
                            </div>
 
                            {turnoSeleccionado.direccion && (
                                <div className="detalle-fila">
                                    <span className="detalle-etiqueta">Dirección</span>
                                    <span>
                                        {turnoSeleccionado.direccion}
                                        {turnoSeleccionado.localidad_club ? `, ${turnoSeleccionado.localidad_club}` : ''}
                                    </span>
                                </div>
                            )}
 
                            {turnoSeleccionado.telefono_club && (
                                <div className="detalle-fila">
                                    <span className="detalle-etiqueta">Teléfono del club</span>
                                    <span>{turnoSeleccionado.telefono_club}</span>
                                </div>
                            )}

                            {turnoSeleccionado.estado?.toLowerCase() === 'reservado' && (
                                <button
                                    type="button"
                                    className="btn-cancelar-turno-detalle"
                                    onClick={handleCancelarTurno}
                                    disabled={cancelando}
                                >
                                    {cancelando ? 'Cancelando...' : 'Cancelar turno'}
                                </button>
                            )}

                        </div>
                    )}
 
                </div>
 
            </div>
        </>
    );
}
 
export default MisTurnos;