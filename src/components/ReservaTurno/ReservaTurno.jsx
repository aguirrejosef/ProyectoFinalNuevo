import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';
import './ReservaTurno.css';

// Fecha de hoy en el huso horario local (no UTC), formato YYYY-MM-DD
function fechaLocalDeHoy() {
    const ahora = new Date();
    const sinOffset = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
    return sinOffset.toISOString().slice(0, 10);
}

function formatearHora(hora) {
    return hora ? hora.slice(0, 5) : '';
}

function formatearFechaLarga(fechaISO) {
    const f = new Date(`${fechaISO}T00:00:00`);
    return f.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatearPrecio(monto) {
    if (monto === null || monto === undefined || monto === '') return '-';
    return `$${Number(monto).toLocaleString('es-AR')}`;
}

// mm:ss restantes hasta la fecha `hasta` (ISO). Nunca negativo.
function segundosRestantes(hasta) {
    const ms = new Date(hasta).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
}

function formatearCuentaRegresiva(segundos) {
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function ReservaTurno({ club, cancha }) {
    const navigate = useNavigate();
    const hayToken = !!localStorage.getItem('token');

    // 'eligiendo' -> 'revision' -> 'pago'
    const [paso, setPaso] = useState('eligiendo');

    const [fecha, setFecha] = useState(fechaLocalDeHoy());
    const [horarios, setHorarios] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [horarioElegido, setHorarioElegido] = useState(null);
    const [mensaje, setMensaje] = useState('');

    const [titular, setTitular] = useState({
        nombre: [localStorage.getItem('nombre'), localStorage.getItem('apellido')].filter(Boolean).join(' '),
        telefono: localStorage.getItem('telefono') || '',
        correo: localStorage.getItem('correo') || ''
    });

    const [confirmando, setConfirmando] = useState(false);
    const [reserva, setReserva] = useState(null); // { id_turno, monto_sena, expira_en, init_point }
    const [segundos, setSegundos] = useState(0);
    const [cancelando, setCancelando] = useState(false);

    useEffect(() => {
        if (!cancha) return;
        cargarDisponibilidad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancha, fecha]);

    const cargarDisponibilidad = async () => {
        if (!cancha) return;

        setCargando(true);
        setMensaje('');
        setHorarioElegido(null);

        try {
            const res = await apiFetch(`/canchas/${cancha.id_cancha}/disponibilidad?fecha=${fecha}`);
            const data = await res.json();
            setHorarios(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error al cargar disponibilidad:', err);
            setMensaje('No se pudo cargar la disponibilidad. Intentá de nuevo.');
        } finally {
            setCargando(false);
        }
    };

    // Cuenta regresiva del paso de pago
    useEffect(() => {
        if (paso !== 'pago' || !reserva) return;

        setSegundos(segundosRestantes(reserva.expira_en));
        const intervalo = setInterval(() => {
            setSegundos(segundosRestantes(reserva.expira_en));
        }, 1000);

        return () => clearInterval(intervalo);
    }, [paso, reserva]);

    if (!cancha) return null;

    const horarioInfo = horarios.find((h) => h.id_horario === horarioElegido);
    const montoSenaEstimado = cancha.precio ? Math.round(Number(cancha.precio) * 0.5) : null;

    const handleIrARevision = () => {
        if (!horarioElegido) return;
        setPaso('revision');
    };

    const handleConfirmarReserva = async () => {
        setConfirmando(true);
        setMensaje('');

        try {
            const res = await apiFetch('/turnos', {
                method: 'POST',
                body: JSON.stringify({ id_cancha: cancha.id_cancha, id_horario: horarioElegido, fecha })
            });

            const data = await res.json();

            if (!res.ok) {
                setMensaje(data.message || 'No se pudo reservar el turno');
                if (res.status === 409) {
                    setHorarios((prev) => prev.map((h) => h.id_horario === horarioElegido ? { ...h, ocupado: true } : h));
                    setHorarioElegido(null);
                    setPaso('eligiendo');
                }
                return;
            }

            if (!data.init_point) {
                setMensaje('El turno se creó pero los pagos no están disponibles en este momento. Contactá al club.');
                return;
            }

            setReserva(data);
            setPaso('pago');

        } catch (error) {
            console.error('Error al reservar turno:', error);
            setMensaje('Error al conectar con el servidor');
        } finally {
            setConfirmando(false);
        }
    };

    const handleIrAPagar = () => {
        if (reserva?.init_point) {
            window.location.href = reserva.init_point;
        }
    };

    const handleCancelarReserva = async () => {
        if (!reserva) return;

        setCancelando(true);
        try {
            await apiFetch(`/turnos/${reserva.id_turno}/cancelar`, { method: 'PUT' });
        } catch (error) {
            console.error('Error al cancelar la reserva pendiente:', error);
        } finally {
            setCancelando(false);
            setReserva(null);
            setPaso('eligiendo');
            cargarDisponibilidad();
        }
    };

    if (!hayToken) {
        return (
            <div className="tarjeta-reserva">
                <p className="reserva-mensaje">Iniciá sesión para poder reservar un turno en {cancha.nombre}.</p>
                <button type="button" className="btn-reservar" onClick={() => navigate('/login')}>
                    Iniciar sesión
                </button>
            </div>
        );
    }

    // ------------------ Paso 2: revisión antes de pagar ------------------
    if (paso === 'revision') {
        return (
            <div className="tarjeta-reserva tarjeta-revision">
                <h3 className="titulo-reserva">¡Ya casi terminamos!</h3>
                <p className="reserva-subtitulo">Chequeá tus datos y confirmá para continuar con el pago de la seña.</p>

                <div className="resumen-reserva">
                    <div className="resumen-club">
                        <strong>{club?.nombre}</strong>
                        {club?.direccion && <span>{club.direccion}{club.localidad ? `, ${club.localidad}` : ''}</span>}
                    </div>

                    <div className="resumen-fila">
                        <span>Fecha</span>
                        <strong>{formatearFechaLarga(fecha)}</strong>
                    </div>
                    <div className="resumen-fila">
                        <span>Turno</span>
                        <strong>{formatearHora(horarioInfo?.hora_inicio)} a {formatearHora(horarioInfo?.hora_fin)}</strong>
                    </div>
                    <div className="resumen-fila">
                        <span>Cancha</span>
                        <strong>{cancha.nombre}{cancha.tipo ? ` - ${cancha.tipo}` : ''}</strong>
                    </div>
                    <div className="resumen-fila">
                        <span>Precio de la cancha</span>
                        <strong>{formatearPrecio(cancha.precio)}</strong>
                    </div>
                    <div className="resumen-fila resumen-fila-destacada">
                        <span>Ahora pagás (seña)</span>
                        <strong>{formatearPrecio(montoSenaEstimado)}</strong>
                    </div>
                </div>

                <div className="titular-reserva">
                    <label>
                        Nombre y apellido
                        <input
                            type="text"
                            value={titular.nombre}
                            onChange={(e) => setTitular({ ...titular, nombre: e.target.value })}
                        />
                    </label>
                    <label>
                        Teléfono
                        <input
                            type="tel"
                            value={titular.telefono}
                            onChange={(e) => setTitular({ ...titular, telefono: e.target.value })}
                        />
                    </label>
                    <label>
                        E-mail
                        <input
                            type="email"
                            value={titular.correo}
                            onChange={(e) => setTitular({ ...titular, correo: e.target.value })}
                        />
                    </label>
                </div>

                {mensaje && <p className="reserva-mensaje">{mensaje}</p>}

                <div className="botones-revision">
                    <button type="button" className="btn-volver-revision" onClick={() => setPaso('eligiendo')}>
                        Volver
                    </button>
                    <button type="button" className="btn-reservar" onClick={handleConfirmarReserva} disabled={confirmando}>
                        {confirmando ? 'Generando el pago...' : 'Continuar'}
                    </button>
                </div>
            </div>
        );
    }

    // ------------------ Paso 3: pagar la seña ------------------
    if (paso === 'pago' && reserva) {
        const expirado = segundos <= 0;

        return (
            <div className="tarjeta-reserva tarjeta-pago">
                <div className="resumen-reserva">
                    <div className="resumen-club">
                        <strong>{club?.nombre}</strong>
                        {club?.direccion && <span>{club.direccion}{club.localidad ? `, ${club.localidad}` : ''}</span>}
                    </div>

                    <div className="resumen-fila">
                        <span>Fecha</span>
                        <strong>{formatearFechaLarga(fecha)}</strong>
                    </div>
                    <div className="resumen-fila">
                        <span>Turno</span>
                        <strong>{formatearHora(horarioInfo?.hora_inicio)} a {formatearHora(horarioInfo?.hora_fin)}</strong>
                    </div>
                    <div className="resumen-fila">
                        <span>Cancha</span>
                        <strong>{cancha.nombre}</strong>
                    </div>
                    <div className="resumen-fila resumen-fila-destacada">
                        <span>Anticipo / Seña</span>
                        <strong>{formatearPrecio(reserva.monto_sena)}</strong>
                    </div>
                </div>

                {!expirado ? (
                    <>
                        <p className="cuenta-regresiva">Tenés {formatearCuentaRegresiva(segundos)} minutos para pagar</p>
                        <div className="botones-pago">
                            <button type="button" className="btn-ir-a-pagar" onClick={handleIrAPagar}>
                                Ir a pagar
                            </button>
                            <button type="button" className="btn-cancelar-pago" onClick={handleCancelarReserva} disabled={cancelando}>
                                {cancelando ? 'Cancelando...' : 'Cancelar'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="cuenta-regresiva cuenta-regresiva-vencida">El tiempo para pagar venció, el horario volvió a estar disponible.</p>
                        <button type="button" className="btn-reservar" onClick={handleCancelarReserva} disabled={cancelando}>
                            Elegir otro horario
                        </button>
                    </>
                )}
            </div>
        );
    }

    // ------------------ Paso 1: elegir fecha y horario ------------------
    return (
        <div className="tarjeta-reserva">
            <h3 className="titulo-reserva">Reservar en {cancha.nombre}</h3>

            <label className="label-fecha-reserva">
                Fecha
                <input
                    type="date"
                    min={fechaLocalDeHoy()}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                />
            </label>

            {cargando && <p className="reserva-mensaje">Cargando horarios...</p>}

            {!cargando && horarios.length === 0 && (
                <p className="reserva-mensaje">Este club todavía no cargó horarios reservables para esta cancha.</p>
            )}

            {!cargando && horarios.length > 0 && (
                <div className="grid-horarios-reserva">
                    {horarios.map((h) => (
                        <button
                            type="button"
                            key={h.id_horario}
                            className={`btn-horario-reserva ${h.ocupado ? 'horario-ocupado' : ''} ${horarioElegido === h.id_horario ? 'horario-elegido' : ''}`}
                            disabled={h.ocupado}
                            onClick={() => setHorarioElegido(h.id_horario)}
                        >
                            {formatearHora(h.hora_inicio)} - {formatearHora(h.hora_fin)}
                        </button>
                    ))}
                </div>
            )}

            {mensaje && <p className="reserva-mensaje">{mensaje}</p>}

            <button
                type="button"
                className="btn-reservar"
                onClick={handleIrARevision}
                disabled={!horarioElegido}
            >
                Continuar
            </button>
        </div>
    );
}

export default ReservaTurno;
