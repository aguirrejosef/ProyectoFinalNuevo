import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { apiFetch } from '../../api';
import './ReservaConfirmacion.css';

const INTENTOS_MAXIMOS = 15;
const ESPERA_ENTRE_INTENTOS_MS = 3000;

function ReservaConfirmacion() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const idTurno = searchParams.get('turno');

    const [estado, setEstado] = useState('cargando'); // cargando | pagado | rechazado | pendiente | error

    useEffect(() => {
        if (!idTurno) {
            setEstado('error');
            return;
        }

        let cancelado = false;

        const consultar = async (intento) => {
            try {
                const res = await apiFetch(`/pagos/estado/${idTurno}`);
                const data = await res.json();

                if (cancelado) return;

                if (data.estado === 'pagado' || data.estado === 'rechazado') {
                    setEstado(data.estado);
                    return;
                }

                if (intento >= INTENTOS_MAXIMOS) {
                    setEstado('pendiente');
                    return;
                }

                setTimeout(() => consultar(intento + 1), ESPERA_ENTRE_INTENTOS_MS);

            } catch (error) {
                console.error('Error al consultar el estado del pago:', error);
                if (!cancelado) setEstado('error');
            }
        };

        consultar(1);

        return () => { cancelado = true; };
    }, [idTurno]);

    const contenidoPorEstado = {
        cargando: {
            titulo: 'Confirmando tu pago...',
            texto: 'Esto puede tardar unos segundos.'
        },
        pagado: {
            titulo: '¡Reserva confirmada! 🎉',
            texto: 'Ya podés ver el turno en Mis Reservas.'
        },
        rechazado: {
            titulo: 'El pago no se completó',
            texto: 'El horario volvió a estar disponible. Podés intentar reservarlo de nuevo.'
        },
        pendiente: {
            titulo: 'Todavía estamos esperando la confirmación',
            texto: 'Puede demorar unos minutos más. Revisá Mis Reservas más tarde.'
        },
        error: {
            titulo: 'No pudimos verificar tu pago',
            texto: 'Si el dinero fue debitado, contactá al club para confirmar tu reserva.'
        }
    };

    const { titulo, texto } = contenidoPorEstado[estado];

    return (
        <div>
            <NavBar />
            <div className="contenedor-confirmacion-pago">
                <div className="tarjeta-confirmacion-pago">
                    {estado === 'cargando' && <div className="spinner-confirmacion"></div>}
                    <h2>{titulo}</h2>
                    <p>{texto}</p>

                    {estado !== 'cargando' && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={() => navigate('/mis-turnos')}>
                                Ver mis reservas
                            </button>
                            {estado === 'rechazado' && (
                                <button type="button" className="btn-secundario-confirmacion" onClick={() => navigate('/canchas')}>
                                    Buscar otro club
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default ReservaConfirmacion;
