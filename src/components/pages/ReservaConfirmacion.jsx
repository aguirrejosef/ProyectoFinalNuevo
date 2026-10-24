import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { apiFetch } from '../../api';
import './ReservaConfirmacion.css';

// Mercado Pago se abre en otra pestaña y el usuario puede tardar en pagar
// ahí, así que esperamos varios minutos (parecido al tiempo que se sostiene
// la reserva) en vez de solo unos segundos.
const INTENTOS_MAXIMOS = 120;
const ESPERA_ENTRE_INTENTOS_MS = 5000;
const ESPERA_REDIRECCION_MS = 2500;
// Un solo error de red (wifi que titila un segundo) no debería tirar toda
// la espera a la basura; recién si falla varias veces seguidas asumimos que
// el problema es real.
const ERRORES_DE_RED_SEGUIDOS_MAXIMOS = 3;

function ReservaConfirmacion() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const idTurno = searchParams.get('turno');
    const initPoint = searchParams.get('initPoint');

    const [estado, setEstado] = useState('cargando'); // cargando | pagado | rechazado | pendiente | error

    // sessionStorage es por pestaña. La pestaña original (donde el cliente
    // venía reservando) la marca ella misma antes de abrir Mercado Pago (ver
    // ReservaTurno.jsx). Si Mercado Pago después vuelve solo a esta misma URL
    // pero en la OTRA pestaña (la que abrió), esa no va a tener la marca —
    // así la distinguimos sin depender de window.opener, que se puede perder
    // al navegar a través del dominio de Mercado Pago.
    const [esPestanaOriginal] = useState(() => {
        if (!idTurno) return true;
        try {
            return sessionStorage.getItem(`pestana-original-turno-${idTurno}`) === '1';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (!idTurno) {
            setEstado('error');
            return;
        }

        let cancelado = false;

        const consultar = async (intento, erroresDeRedSeguidos = 0) => {
            try {
                const res = await apiFetch(`/pagos/estado/${idTurno}`);
                const data = await res.json();

                if (cancelado) return;

                // 403/404/500: no es que el pago esté pendiente, es que algo
                // anda mal (turno inexistente, no autorizado, servidor caído).
                // Insistir 10 minutos contra eso no tiene sentido.
                if (!res.ok) {
                    setEstado('error');
                    return;
                }

                if (data.estado === 'pagado' || data.estado === 'rechazado') {
                    setEstado(data.estado);
                    return;
                }

                // 'sin_pago' (no hay registro de pago para este turno) o
                // 'error' (Mercado Pago no está configurado en el servidor)
                // tampoco se van a resolver solos reintentando.
                if (data.estado === 'sin_pago' || data.estado === 'error') {
                    setEstado('error');
                    return;
                }

                if (intento >= INTENTOS_MAXIMOS) {
                    setEstado('pendiente');
                    return;
                }

                setTimeout(() => consultar(intento + 1, 0), ESPERA_ENTRE_INTENTOS_MS);

            } catch (error) {
                console.error('Error al consultar el estado del pago:', error);
                if (cancelado) return;

                const siguienteConteo = erroresDeRedSeguidos + 1;
                if (siguienteConteo >= ERRORES_DE_RED_SEGUIDOS_MAXIMOS) {
                    setEstado('error');
                    return;
                }
                setTimeout(() => consultar(intento, siguienteConteo), ESPERA_ENTRE_INTENTOS_MS);
            }
        };

        consultar(1);

        return () => { cancelado = true; };
    }, [idTurno]);

    useEffect(() => {
        if (estado !== 'pagado') return;

        // El NavBar ya está montado desde antes de pagar; sin este aviso no
        // se enteraría del turno nuevo hasta la próxima navegación.
        window.dispatchEvent(new Event('turnos-actualizados'));

        if (!esPestanaOriginal) {
            // Esta es la pestaña que abrió Mercado Pago, no la original: no
            // tiene por qué conservar una sesión confiable para ir a una ruta
            // protegida, así que directamente se cierra sola.
            window.close();
            return;
        }

        const timer = setTimeout(() => navigate('/mis-turnos'), ESPERA_REDIRECCION_MS);
        return () => clearTimeout(timer);
    }, [estado, navigate, esPestanaOriginal]);

    const contenidoPorEstado = {
        cargando: {
            titulo: 'Esperando tu pago...',
            texto: esPestanaOriginal
                ? 'Completá el pago en la pestaña de Mercado Pago que se abrió. En cuanto lo confirmes, esta pantalla se va a actualizar sola.'
                : 'Completá el pago acá. Cuando termines, esta pestaña se cierra sola.'
        },
        pagado: {
            titulo: '¡Reserva confirmada! 🎉',
            texto: esPestanaOriginal ? 'Te llevamos a Mis Reservas en un momento...' : 'Ya podés cerrar esta pestaña.'
        },
        rechazado: {
            titulo: 'El pago no se completó',
            texto: esPestanaOriginal
                ? 'El horario volvió a estar disponible. Podés intentar reservarlo de nuevo.'
                : 'Podés cerrar esta pestaña y volver a intentar desde la otra.'
        },
        pendiente: {
            titulo: 'Todavía estamos esperando la confirmación',
            texto: esPestanaOriginal
                ? 'Puede demorar unos minutos más. Revisá Mis Reservas más tarde.'
                : 'Puede demorar unos minutos más. Podés cerrar esta pestaña y revisar Mis Reservas más tarde.'
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

                    {estado === 'cargando' && esPestanaOriginal && initPoint && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={() => window.open(initPoint, '_blank')}>
                                Abrir Mercado Pago
                            </button>
                            <p className="confirmacion-pago-ayuda">
                                ¿No se abrió la pestaña, o la cerraste sin pagar? Volvé a abrirla acá.
                            </p>
                        </div>
                    )}

                    {estado !== 'cargando' && esPestanaOriginal && (
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

                    {estado !== 'cargando' && !esPestanaOriginal && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={() => window.close()}>
                                Cerrar pestaña
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default ReservaConfirmacion;
