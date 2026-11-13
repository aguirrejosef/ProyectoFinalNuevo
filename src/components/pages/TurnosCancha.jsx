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

    const [bloqueos, setBloqueos] = useState([]);
    const [mostrandoFormBloqueo, setMostrandoFormBloqueo] = useState(false);
    const [fechaBloqueo, setFechaBloqueo] = useState('');
    const [horaInicioBloqueo, setHoraInicioBloqueo] = useState('');
    const [horaFinBloqueo, setHoraFinBloqueo] = useState('');
    const [motivoBloqueo, setMotivoBloqueo] = useState('');
    const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
    const [errorBloqueo, setErrorBloqueo] = useState('');

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

    const cargarBloqueos = async () => {
        try {
            const res = await apiFetch(`/canchas/${idCancha}/bloqueos`);
            if (!res.ok) return;
            const data = await res.json();
            setBloqueos(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error al cargar bloqueos:', err);
        }
    };

    useEffect(() => {
        cargarTurnos();
        cargarBloqueos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idCancha]);

    const handleCrearBloqueo = async () => {
        if (!fechaBloqueo || !horaInicioBloqueo || !horaFinBloqueo) return;

        setGuardandoBloqueo(true);
        setErrorBloqueo('');
        try {
            const res = await apiFetch(`/canchas/${idCancha}/bloqueos`, {
                method: 'POST',
                body: JSON.stringify({
                    fecha: fechaBloqueo,
                    hora_inicio: `${horaInicioBloqueo}:00`,
                    hora_fin: `${horaFinBloqueo}:00`,
                    motivo: motivoBloqueo
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setErrorBloqueo(data.message || 'No se pudo bloquear el horario');
                return;
            }

            setFechaBloqueo('');
            setHoraInicioBloqueo('');
            setHoraFinBloqueo('');
            setMotivoBloqueo('');
            setMostrandoFormBloqueo(false);
            cargarBloqueos();

        } catch (err) {
            console.error('Error al crear bloqueo:', err);
            setErrorBloqueo('Error al conectar con el servidor');
        } finally {
            setGuardandoBloqueo(false);
        }
    };

    const handleEliminarBloqueo = async (idBloqueo) => {
        try {
            const res = await apiFetch(`/bloqueos/${idBloqueo}`, { method: 'DELETE' });
            if (res.ok) cargarBloqueos();
        } catch (err) {
            console.error('Error al eliminar bloqueo:', err);
        }
    };
 
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

                <div className="seccion-bloqueos-cancha">
                    <div className="seccion-bloqueos-header">
                        <h3>Horarios bloqueados</h3>
                        <button type="button" className="btn-nuevo-bloqueo" onClick={() => setMostrandoFormBloqueo((v) => !v)}>
                            {mostrandoFormBloqueo ? 'Cancelar' : '+ Bloquear horario'}
                        </button>
                    </div>

                    {mostrandoFormBloqueo && (
                        <div className="form-bloqueo-cancha">
                            <div className="form-bloqueo-fila">
                                <label>
                                    Fecha
                                    <input type="date" value={fechaBloqueo} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFechaBloqueo(e.target.value)} />
                                </label>
                                <label>
                                    Desde
                                    <input type="time" value={horaInicioBloqueo} onChange={(e) => setHoraInicioBloqueo(e.target.value)} />
                                </label>
                                <label>
                                    Hasta
                                    <input type="time" value={horaFinBloqueo} onChange={(e) => setHoraFinBloqueo(e.target.value)} />
                                </label>
                            </div>
                            <label className="form-bloqueo-motivo">
                                Motivo (opcional)
                                <input type="text" placeholder="Ej: arreglo de la red" value={motivoBloqueo} onChange={(e) => setMotivoBloqueo(e.target.value)} />
                            </label>
                            {errorBloqueo && <p className="error-turnos-cancha">{errorBloqueo}</p>}
                            <button
                                type="button"
                                className="btn-guardar-bloqueo"
                                onClick={handleCrearBloqueo}
                                disabled={guardandoBloqueo || !fechaBloqueo || !horaInicioBloqueo || !horaFinBloqueo}
                            >
                                {guardandoBloqueo ? 'Guardando...' : 'Bloquear'}
                            </button>
                        </div>
                    )}

                    {bloqueos.length === 0 ? (
                        <p className="mensaje-turnos-cancha mensaje-sin-bloqueos">No tenés horarios bloqueados próximamente.</p>
                    ) : (
                        <div className="lista-bloqueos-cancha">
                            {bloqueos.map((b) => (
                                <div key={b.id_bloqueo} className="item-bloqueo-cancha">
                                    <span>{formatearFecha(b.fecha)} · {formatearHora(b.hora_inicio)} a {formatearHora(b.hora_fin)}</span>
                                    {b.motivo && <span className="item-bloqueo-motivo">{b.motivo}</span>}
                                    <button type="button" className="btn-quitar-bloqueo" onClick={() => handleEliminarBloqueo(b.id_bloqueo)}>
                                        Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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
                                <span data-label="Fecha">{formatearFecha(t.fecha)}</span>
                                <span data-label="Horario">{formatearHora(t.hora_inicio)} a {formatearHora(t.hora_fin)}</span>
                                <span data-label="Cliente">{t.cliente_nombre} {t.cliente_apellido}</span>
                                <span data-label="Teléfono">{t.cliente_telefono || '-'}</span>
                                <span data-label="Estado" className={`estado-turno-cancha estado-${t.estado?.toLowerCase()}`}>
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