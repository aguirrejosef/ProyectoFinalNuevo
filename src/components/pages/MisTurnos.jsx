import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import './MisTurnos.css';
import { apiFetch } from '../../api';
 
const TABS = [
    { key: 'reservado', label: 'Reservadas' },
    { key: 'completado', label: 'Completadas' },
    { key: 'cancelado', label: 'Canceladas' }
];

const LIMITE_POR_PAGINA = 8;
 
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
    const [mostrandoConfirmacionCancelar, setMostrandoConfirmacionCancelar] = useState(false);
    const [errorCancelar, setErrorCancelar] = useState('');

    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [total, setTotal] = useState(0);

    const idUsuario = localStorage.getItem('id');

    const cargarTurnos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(
                `/turnos?id_usuario=${idUsuario}&estado=${tabActiva}&pagina=${pagina}&limite=${LIMITE_POR_PAGINA}`
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message || 'Error al cargar turnos');
                return;
            }

            const data = await res.json();
            setTurnos(Array.isArray(data.turnos) ? data.turnos : []);
            setTotal(data.total || 0);
            setTotalPaginas(data.totalPaginas || 1);

        } catch (err) {
            console.error('Error al cargar turnos:', err);
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    }, [idUsuario, tabActiva, pagina]);

    useEffect(() => {
        const rol = localStorage.getItem('rol');

        if (!rol || !idUsuario) {
            navigate('/login');
            return;
        }

        cargarTurnos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargarTurnos]);

    // Si quedó algún turno "pendiente_pago" (por ej. porque el cliente no
    // volvió del checkout de Mercado Pago), reconsultamos el estado real del
    // pago una sola vez al entrar. Esto es independiente de la pestaña/página
    // que se esté mirando, porque "pendiente_pago" no tiene pestaña propia.
    useEffect(() => {
        if (!idUsuario) return;

        const revisarPendientes = async () => {
            try {
                const res = await apiFetch(`/turnos?id_usuario=${idUsuario}&estado=pendiente_pago&limite=50`);
                if (!res.ok) return;
                const data = await res.json();
                const pendientes = Array.isArray(data.turnos) ? data.turnos : [];

                if (pendientes.length === 0) return;

                const resultados = await Promise.all(
                    pendientes.map((t) =>
                        apiFetch(`/pagos/estado/${t.id_turno}`)
                            .then((r) => r.json())
                            .catch(() => null)
                    )
                );

                const huboCambios = resultados.some(
                    (r) => r && (r.estado === 'pagado' || r.estado === 'rechazado')
                );

                if (huboCambios) {
                    cargarTurnos();
                }
            } catch (err) {
                console.error('Error al revisar turnos pendientes de pago:', err);
            }
        };

        revisarPendientes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idUsuario]);
 
    const formatearFecha = (fecha) => {
        const f = new Date(fecha);
        return f.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };
 
    const formatearHora = (hora) => hora ? hora.slice(0, 5) : '';
 
    const handleCambiarTab = (tab) => {
        setTabActiva(tab);
        setTurnoSeleccionado(null);
        setPagina(1);
    };

    const handleAbrirConfirmacionCancelar = () => {
        setErrorCancelar('');
        setMostrandoConfirmacionCancelar(true);
    };

    const handleCerrarConfirmacionCancelar = () => {
        if (cancelando) return;
        setMostrandoConfirmacionCancelar(false);
    };

    const handleCancelarTurno = async () => {
        if (!turnoSeleccionado) return;

        setCancelando(true);
        setErrorCancelar('');

        try {
            const res = await apiFetch(`/turnos/${turnoSeleccionado.id_turno}/cancelar`, {
                method: 'PUT'
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setErrorCancelar(data.message || 'No se pudo cancelar el turno');
                return;
            }

            setTurnoSeleccionado(null);
            setMostrandoConfirmacionCancelar(false);
            cargarTurnos();

        } catch (err) {
            console.error('Error al cancelar turno:', err);
            setErrorCancelar('Error al conectar con el servidor');
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
 
                    {!loading && !error && turnos.length === 0 && (
                        <div className="vacio-turnos">
                            <IconoVacio />
                            <p className="vacio-titulo">{MENSAJES_VACIO[tabActiva].titulo}</p>
                            <p className="vacio-texto">{MENSAJES_VACIO[tabActiva].texto}</p>
                        </div>
                    )}

                    {!loading && !error && turnos.length > 0 && (
                        <div className="lista-turnos">
                            {turnos.map((turno) => (
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

                    {!loading && !error && totalPaginas > 1 && (
                        <div className="paginado-mis-turnos">
                            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>‹ Anterior</button>
                            <span>Página {pagina} de {totalPaginas} ({total})</span>
                            <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente ›</button>
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
                                    onClick={handleAbrirConfirmacionCancelar}
                                >
                                    Cancelar turno
                                </button>
                            )}

                        </div>
                    )}
 
                </div>
 
            </div>

            {mostrandoConfirmacionCancelar && (
                <div className="overlay-modal" onClick={handleCerrarConfirmacionCancelar}>
                    <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                        <h3>Cancelar turno</h3>
                        <p>¿Seguro que querés cancelar este turno? Esta acción no se puede deshacer.</p>

                        {errorCancelar && <p className="error-modal-cancha">{errorCancelar}</p>}

                        <div className="modal-cancha-botones">
                            <button type="button" className="btn-modal-cancelar" onClick={handleCerrarConfirmacionCancelar} disabled={cancelando}>
                                No, volver
                            </button>
                            <button type="button" className="btn-modal-eliminar" onClick={handleCancelarTurno} disabled={cancelando}>
                                {cancelando ? 'Cancelando...' : 'Sí, cancelar turno'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default MisTurnos;