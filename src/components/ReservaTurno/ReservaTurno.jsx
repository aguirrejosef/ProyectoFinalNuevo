import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';
import { perfilCompletoDesdeLocalStorage } from '../../utils/perfilCompleto';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTableTennisPaddleBall,
    faLocationDot,
    faCalendarCheck,
    faClock,
    faUser,
    faPhone,
    faEnvelope,
    faCircleInfo
} from '@fortawesome/free-solid-svg-icons';
import './ReservaTurno.css';
import '../Modal/ModalConfirmacion.css';

const DURACIONES_MIN = [60, 90, 120];

// Fecha de hoy en el huso horario local (no UTC), formato YYYY-MM-DD
function fechaLocalDeHoy() {
    const ahora = new Date();
    const sinOffset = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
    return sinOffset.toISOString().slice(0, 10);
}

function formatearHora(hora) {
    return hora ? hora.slice(0, 5) : '';
}

function formatearDuracion(minutos) {
    if (minutos === 60) return '1 hora';
    if (minutos % 60 === 0) return `${minutos / 60} horas`;
    return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
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

function ReservaTurno({ club, cancha, onCambiarPaso }) {
    const navigate = useNavigate();
    const hayToken = !!localStorage.getItem('token');

    // 'eligiendo' -> 'revision' -> 'pago'
    const [paso, setPaso] = useState('eligiendo');

    useEffect(() => {
        onCambiarPaso?.(paso);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paso]);

    const [fecha, setFecha] = useState(fechaLocalDeHoy());
    const [disponibilidad, setDisponibilidad] = useState({ abierto: null, horarios: [] });
    const [cargando, setCargando] = useState(false);
    const [horaInicioElegida, setHoraInicioElegida] = useState(null);
    const [duracionElegida, setDuracionElegida] = useState(null);
    const [mensaje, setMensaje] = useState('');

    const [titular] = useState({
        nombre: [localStorage.getItem('nombre'), localStorage.getItem('apellido')].filter(Boolean).join(' '),
        telefono: localStorage.getItem('telefono') || '',
        correo: localStorage.getItem('correo') || ''
    });

    const [confirmando, setConfirmando] = useState(false);
    const [reserva, setReserva] = useState(null); // { id_turno, monto_sena, expira_en, init_point }
    const [segundos, setSegundos] = useState(0);
    const [cancelando, setCancelando] = useState(false);
    const [mostrandoConfirmacionFinal, setMostrandoConfirmacionFinal] = useState(false);

    useEffect(() => {
        if (!cancha) return;
        cargarDisponibilidad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancha, fecha]);

    const cargarDisponibilidad = async () => {
        if (!cancha) return;

        setCargando(true);
        setMensaje('');
        setHoraInicioElegida(null);
        setDuracionElegida(null);

        try {
            const res = await apiFetch(`/canchas/${cancha.id_cancha}/disponibilidad?fecha=${fecha}`);
            const data = await res.json();
            setDisponibilidad(data && Array.isArray(data.horarios) ? data : { abierto: false, horarios: [] });
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

    // Agrupamos las combinaciones por hora de inicio, para el selector en dos pasos
    const horasInicioDisponibles = [...new Set(disponibilidad.horarios.map((h) => h.hora_inicio))];
    const duracionesParaInicioElegido = disponibilidad.horarios.filter((h) => h.hora_inicio === horaInicioElegida);
    const algunaDuracionDisponible = (horaInicio) =>
        disponibilidad.horarios.some((h) => h.hora_inicio === horaInicio && h.disponible);

    const combinacionElegida = disponibilidad.horarios.find(
        (h) => h.hora_inicio === horaInicioElegida && h.minutos === duracionElegida
    );

    // El precio por hora depende del horario elegido (de día o nocturno, si
    // el club y la cancha lo tienen configurado); lo calcula el backend y
    // viene incluido en cada combinación de disponibilidad.
    const precioPorHora = combinacionElegida?.precio_hora ? Number(combinacionElegida.precio_hora) : null;
    const precioTotalEstimado = precioPorHora && duracionElegida ? precioPorHora * (duracionElegida / 60) : null;
    const montoSenaEstimado = precioTotalEstimado ? Math.round(precioTotalEstimado * 0.5) : null;

    const handleElegirHoraInicio = (horaInicio) => {
        setHoraInicioElegida(horaInicio);
        setDuracionElegida(null);
    };

    const handleIrARevision = () => {
        if (!combinacionElegida) return;

        if (!perfilCompletoDesdeLocalStorage()) {
            navigate('/mi-perfil', {
                state: {
                    avisoPerfilIncompleto: 'Para reservar necesitás completar tus datos de perfil (nombre, apellido, DNI y teléfono).'
                }
            });
            return;
        }

        setPaso('revision');
    };

    const handleAbrirConfirmacionFinal = () => {
        setMostrandoConfirmacionFinal(true);
    };

    const handleCerrarConfirmacionFinal = () => {
        if (confirmando) return;
        setMostrandoConfirmacionFinal(false);
    };

    const handleConfirmarReserva = async () => {
        setConfirmando(true);
        setMensaje('');

        try {
            const res = await apiFetch('/turnos', {
                method: 'POST',
                body: JSON.stringify({
                    id_cancha: cancha.id_cancha,
                    fecha,
                    hora_inicio: horaInicioElegida,
                    minutos: duracionElegida
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.perfilIncompleto) {
                    navigate('/mi-perfil', {
                        state: {
                            avisoPerfilIncompleto: data.message || 'Te faltan completar algunos datos de tu perfil para poder reservar turnos.'
                        }
                    });
                    return;
                }
                if (res.status === 409) {
                    // cargarDisponibilidad() limpia el mensaje al arrancar, así
                    // que hay que esperarla antes de mostrar el error del 409;
                    // si no, el mensaje queda borrado antes de que se vea.
                    setPaso('eligiendo');
                    await cargarDisponibilidad();
                }
                setMensaje(data.message || 'No se pudo reservar el turno');
                return;
            }

            if (!data.init_point) {
                // Sin link de pago no hay forma de confirmar la reserva, así
                // que liberamos el horario de una (si no, quedaría "reservado"
                // ocupando el turno 10 minutos sin que el cliente pueda hacer
                // nada al respecto).
                apiFetch(`/turnos/${data.id_turno}/cancelar`, { method: 'PUT' }).catch((err) =>
                    console.error('Error al liberar el turno sin pago disponible:', err)
                );
                setMensaje('No se pudo generar el pago en este momento, así que no se confirmó la reserva. Contactá al club o intentá de nuevo más tarde.');
                return;
            }

            setReserva(data);
            setPaso('pago');

        } catch (error) {
            console.error('Error al reservar turno:', error);
            setMensaje('Error al conectar con el servidor');
        } finally {
            setConfirmando(false);
            setMostrandoConfirmacionFinal(false);
        }
    };

    const handleIrAPagar = () => {
        if (!reserva?.init_point) return;

        // Abrimos Mercado Pago en una pestaña nueva y nos quedamos en la
        // pantalla de confirmación (que ya consulta el estado del pago solo).
        // Así no dependemos de que Mercado Pago nos redirija de vuelta, algo
        // que solo funciona si el sitio tiene una URL pública.
        // Mandamos el init_point también por la URL (no solo abrirlo acá),
        // para que la pantalla de confirmación pueda ofrecer un botón para
        // volver a abrirlo si el navegador bloqueó el popup o el usuario
        // cerró la pestaña sin pagar.
        window.open(reserva.init_point, '_blank');
        navigate(`/reserva-confirmacion?turno=${reserva.id_turno}&initPoint=${encodeURIComponent(reserva.init_point)}`);
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
        const precioRestante = precioTotalEstimado && montoSenaEstimado
            ? precioTotalEstimado - montoSenaEstimado
            : null;

        return (
            <div className="revision-layout">
                <div className="revision-stepper">
                    <div className="revision-paso revision-paso-hecho">
                        <span className="revision-paso-circulo">✓</span>
                        <span className="revision-paso-label">Club</span>
                    </div>
                    <span className="revision-paso-linea revision-paso-linea-hecha"></span>
                    <div className="revision-paso revision-paso-hecho">
                        <span className="revision-paso-circulo">✓</span>
                        <span className="revision-paso-label">Día y turno</span>
                    </div>
                    <span className="revision-paso-linea"></span>
                    <div className="revision-paso revision-paso-actual">
                        <span className="revision-paso-circulo">3</span>
                        <span className="revision-paso-label">Confirmar</span>
                    </div>
                </div>

                <div className="revision-header">
                    <h2 className="revision-titulo">Último punto antes de reservar</h2>
                    <p className="revision-subtitulo">
                        Revisá tus datos y confirmamos tu cancha en {club?.nombre}.
                    </p>
                </div>

                <div className="revision-columnas">

                    <div className="revision-ticket">
                        <div className="revision-ticket-header">
                            <span className="revision-ticket-etiqueta">
                                <FontAwesomeIcon icon={faTableTennisPaddleBall} /> Pase de cancha
                            </span>
                            <h3>{club?.nombre}</h3>
                            {club?.direccion && (
                                <p>
                                    <FontAwesomeIcon icon={faLocationDot} />{' '}
                                    {club.direccion}{club.localidad ? `, ${club.localidad}` : ''}
                                </p>
                            )}
                        </div>

                        <div className="revision-ticket-recorte">
                            <span className="revision-ticket-notch revision-ticket-notch-izq"></span>
                            <span className="revision-ticket-notch revision-ticket-notch-der"></span>
                        </div>

                        <div className="revision-ticket-datos">
                            <div className="revision-ticket-dato">
                                <span className="revision-ticket-dato-icono"><FontAwesomeIcon icon={faCalendarCheck} /></span>
                                <span className="revision-ticket-dato-label">Fecha</span>
                                <strong>{formatearFechaLarga(fecha)}</strong>
                            </div>
                            <div className="revision-ticket-dato">
                                <span className="revision-ticket-dato-icono"><FontAwesomeIcon icon={faClock} /></span>
                                <span className="revision-ticket-dato-label">Turno</span>
                                <strong>{formatearHora(combinacionElegida?.hora_inicio)} - {formatearHora(combinacionElegida?.hora_fin)}</strong>
                            </div>
                            <div className="revision-ticket-dato">
                                <span className="revision-ticket-dato-icono"><FontAwesomeIcon icon={faTableTennisPaddleBall} /></span>
                                <span className="revision-ticket-dato-label">Cancha</span>
                                <strong>{cancha.nombre}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="revision-columna-derecha">
                        <div className="revision-card">
                            <h3 className="revision-card-titulo">Titular de la reserva</h3>
                            <p className="revision-nota-voucher">
                                Te enviaremos el comprobante de la reserva por email. Si estos datos
                                están desactualizados, actualizalos desde tu perfil.
                            </p>
                            <div className="revision-titular-grid">
                                <div className="revision-campo-ancho revision-campo-solo-lectura">
                                    <span><FontAwesomeIcon icon={faUser} /> Nombre y apellido</span>
                                    <strong>{titular.nombre || '-'}</strong>
                                </div>
                                <div className="revision-campo-solo-lectura">
                                    <span><FontAwesomeIcon icon={faPhone} /> Teléfono</span>
                                    <strong>{titular.telefono || '-'}</strong>
                                </div>
                                <div className="revision-campo-solo-lectura">
                                    <span><FontAwesomeIcon icon={faEnvelope} /> E-mail</span>
                                    <strong>{titular.correo || '-'}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="revision-card">
                            <div className="revision-info-pago">
                                <FontAwesomeIcon icon={faCircleInfo} />
                                <div>
                                    <strong>Estás pagando la seña</strong>
                                    <p>El resto de la reserva se abona directamente en el club.</p>
                                </div>
                            </div>
                            <div className="revision-pago-desglose">
                                <div>
                                    <span>Cancha</span>
                                    <strong>{formatearPrecio(precioTotalEstimado)}</strong>
                                </div>
                                <div className="revision-pago-desglose-destacado">
                                    <span>Seña ahora</span>
                                    <strong>{formatearPrecio(montoSenaEstimado)}</strong>
                                </div>
                                <div>
                                    <span>Resto en club</span>
                                    <strong>{formatearPrecio(precioRestante)}</strong>
                                </div>
                            </div>
                        </div>

                        {mensaje && <p className="reserva-mensaje reserva-mensaje-error">{mensaje}</p>}

                        <div className="revision-acciones">
                            <button type="button" className="btn-volver-revision" onClick={() => setPaso('eligiendo')}>
                                ← Volver
                            </button>
                            <button type="button" className="btn-reservar btn-continuar-revision" onClick={handleAbrirConfirmacionFinal}>
                                Confirmar reserva →
                            </button>
                        </div>
                    </div>

                </div>

                {mostrandoConfirmacionFinal && (
                    <div className="overlay-modal" onClick={handleCerrarConfirmacionFinal}>
                        <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                            <h3>¿Confirmar esta reserva?</h3>
                            <p>
                                Vas a pagar la seña de <strong>{formatearPrecio(montoSenaEstimado)}</strong> para
                                reservar {cancha.nombre} el {formatearFechaLarga(fecha)} de{' '}
                                {formatearHora(combinacionElegida?.hora_inicio)} a {formatearHora(combinacionElegida?.hora_fin)}.
                            </p>
                            <p className="aviso-politica-sena">
                                Si el turno se cancela por algún motivo, tenés 24 horas desde la cancelación para
                                reclamar la devolución de la seña; pasado ese plazo, la seña queda sin efecto.
                            </p>

                            {mensaje && <p className="error-modal-cancha">{mensaje}</p>}

                            <div className="modal-cancha-botones">
                                <button type="button" className="btn-modal-cancelar" onClick={handleCerrarConfirmacionFinal} disabled={confirmando}>
                                    Volver
                                </button>
                                <button type="button" className="btn-modal-guardar" onClick={handleConfirmarReserva} disabled={confirmando}>
                                    {confirmando ? 'Generando el pago...' : 'Sí, confirmar y pagar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
                        <strong>{formatearHora(combinacionElegida?.hora_inicio)} a {formatearHora(combinacionElegida?.hora_fin)}</strong>
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

    // ------------------ Paso 1: elegir fecha, hora de inicio y duración ------------------
    return (
        <div className="tarjeta-reserva">
            <h3 className="titulo-reserva">Reservar en {cancha.nombre}</h3>

            <label className="label-fecha-reserva">
                <span><FontAwesomeIcon icon={faCalendarCheck} /> Fecha</span>
                <input
                    type="date"
                    min={fechaLocalDeHoy()}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                />
            </label>

            {cargando && <p className="reserva-mensaje">Cargando horarios...</p>}

            {!cargando && disponibilidad.abierto === false && (
                <p className="reserva-mensaje">El club no atiende ese día.</p>
            )}

            {!cargando && disponibilidad.abierto && horasInicioDisponibles.length === 0 && (
                <p className="reserva-mensaje">No quedan horarios disponibles ese día.</p>
            )}

            {!cargando && horasInicioDisponibles.length > 0 && (
                <>
                    <p className="label-paso-horario"><FontAwesomeIcon icon={faClock} /> Hora de inicio</p>
                    <div className="grid-horarios-reserva">
                        {horasInicioDisponibles.map((horaInicio) => (
                            <button
                                type="button"
                                key={horaInicio}
                                className={`btn-horario-reserva ${!algunaDuracionDisponible(horaInicio) ? 'horario-ocupado' : ''} ${horaInicioElegida === horaInicio ? 'horario-elegido' : ''}`}
                                disabled={!algunaDuracionDisponible(horaInicio)}
                                onClick={() => handleElegirHoraInicio(horaInicio)}
                            >
                                {formatearHora(horaInicio)}
                            </button>
                        ))}
                    </div>

                    {horaInicioElegida && (
                        <>
                            <p className="label-paso-horario">Duración</p>
                            <div className="grid-horarios-reserva grid-duraciones-reserva">
                                {DURACIONES_MIN.map((minutos) => {
                                    const combo = duracionesParaInicioElegido.find((h) => h.minutos === minutos);
                                    if (!combo) return null;

                                    return (
                                        <button
                                            type="button"
                                            key={minutos}
                                            className={`btn-horario-reserva btn-duracion-reserva ${!combo.disponible ? 'horario-ocupado' : ''} ${duracionElegida === minutos ? 'horario-elegido' : ''}`}
                                            disabled={!combo.disponible}
                                            onClick={() => setDuracionElegida(minutos)}
                                        >
                                            <span className="duracion-principal">{formatearDuracion(minutos)}</span>
                                            <span className="duracion-hasta">hasta {formatearHora(combo.hora_fin)}</span>
                                            {combo.precio_hora && (
                                                <span className="duracion-precio">
                                                    {formatearPrecio(Number(combo.precio_hora) * (minutos / 60))}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}

            {mensaje && <p className="reserva-mensaje reserva-mensaje-error">{mensaje}</p>}

            <button
                type="button"
                className="btn-reservar"
                onClick={handleIrARevision}
                disabled={!combinacionElegida}
            >
                Continuar
            </button>
        </div>
    );
}

export default ReservaTurno;
