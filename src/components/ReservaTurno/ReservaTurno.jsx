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

function ReservaTurno({ idCancha, nombreCancha }) {
    const navigate = useNavigate();
    const hayToken = !!localStorage.getItem('token');

    const [fecha, setFecha] = useState(fechaLocalDeHoy());
    const [horarios, setHorarios] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [horarioElegido, setHorarioElegido] = useState(null);
    const [reservando, setReservando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [reservaConfirmada, setReservaConfirmada] = useState(false);

    useEffect(() => {
        if (!idCancha) return;

        setCargando(true);
        setMensaje('');
        setHorarioElegido(null);
        setReservaConfirmada(false);

        apiFetch(`/canchas/${idCancha}/disponibilidad?fecha=${fecha}`)
            .then((res) => res.json())
            .then((data) => setHorarios(Array.isArray(data) ? data : []))
            .catch((err) => {
                console.error('Error al cargar disponibilidad:', err);
                setMensaje('No se pudo cargar la disponibilidad. Intentá de nuevo.');
            })
            .finally(() => setCargando(false));
    }, [idCancha, fecha]);

    const formatearHora = (hora) => (hora ? hora.slice(0, 5) : '');

    const handleReservar = async () => {
        if (!horarioElegido) return;

        setReservando(true);
        setMensaje('');

        try {
            const res = await apiFetch('/turnos', {
                method: 'POST',
                body: JSON.stringify({ id_cancha: idCancha, id_horario: horarioElegido, fecha })
            });

            const data = await res.json();

            if (!res.ok) {
                setMensaje(data.message || 'No se pudo reservar el turno');
                // Si ya lo agarraron mientras elegíamos, refrescamos la grilla
                if (res.status === 409) {
                    setHorarios((prev) => prev.map((h) => h.id_horario === horarioElegido ? { ...h, ocupado: true } : h));
                    setHorarioElegido(null);
                }
                return;
            }

            setReservaConfirmada(true);
            setMensaje('¡Turno reservado correctamente!');
            setHorarios((prev) => prev.map((h) => h.id_horario === horarioElegido ? { ...h, ocupado: true } : h));
            setHorarioElegido(null);

        } catch (error) {
            console.error('Error al reservar turno:', error);
            setMensaje('Error al conectar con el servidor');
        } finally {
            setReservando(false);
        }
    };

    if (!hayToken) {
        return (
            <div className="tarjeta-reserva">
                <p className="reserva-mensaje">Iniciá sesión para poder reservar un turno en {nombreCancha}.</p>
                <button type="button" className="btn-reservar" onClick={() => navigate('/login')}>
                    Iniciar sesión
                </button>
            </div>
        );
    }

    return (
        <div className="tarjeta-reserva">
            <h3 className="titulo-reserva">Reservar en {nombreCancha}</h3>

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
                <p className="reserva-mensaje">No hay horarios cargados para esta cancha.</p>
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

            {mensaje && (
                <p className={`reserva-mensaje ${reservaConfirmada ? 'reserva-mensaje-exito' : ''}`}>{mensaje}</p>
            )}

            {!reservaConfirmada && (
                <button
                    type="button"
                    className="btn-reservar"
                    onClick={handleReservar}
                    disabled={!horarioElegido || reservando}
                >
                    {reservando ? 'Reservando...' : 'Confirmar reserva'}
                </button>
            )}

            {reservaConfirmada && (
                <button type="button" className="btn-reservar btn-ver-mis-turnos" onClick={() => navigate('/mis-turnos')}>
                    Ver mis turnos
                </button>
            )}
        </div>
    );
}

export default ReservaTurno;
