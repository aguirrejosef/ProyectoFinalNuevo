import React, { useEffect, useRef, useState } from 'react';
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
// Si la pestaña original no recibe el aviso de la otra pestaña en este
// tiempo (por ej. si la cerraron sin apretar el botón), le mostramos el
// botón igual para que pueda continuar por su cuenta.
const ESPERA_RESPALDO_MS = 5000;
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
    const [mostrarBotonRespaldo, setMostrarBotonRespaldo] = useState(false);
    const canalRef = useRef(null);

    // La pestaña original (donde el cliente venía reservando) llega acá con
    // ?origen=espera (ver ReservaTurno.jsx). El back_url que le dimos a
    // Mercado Pago para la OTRA pestaña (la que abrió, y que puede volver
    // sola tras pagar) no incluye ese parámetro, así que se distinguen
    // leyendo la propia URL — sin depender de sessionStorage/localStorage ni
    // de window.opener, que pueden comportarse distinto entre navegadores al
    // atravesar el dominio de Mercado Pago.
    const esPestanaOriginal = searchParams.get('origen') === 'espera';

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

    // Canal para que la pestaña de Mercado Pago le avise a la original que
    // ya puede ir a Mis Reservas.
    useEffect(() => {
        if (!idTurno) return;

        const canal = new BroadcastChannel(`turno-pago-${idTurno}`);
        canalRef.current = canal;

        if (esPestanaOriginal) {
            canal.onmessage = (evento) => {
                if (evento.data?.tipo === 'continuar') {
                    navigate('/mis-turnos');
                }
            };
        }

        return () => canal.close();
    }, [idTurno, esPestanaOriginal, navigate]);

    useEffect(() => {
        if (estado !== 'pagado') return;

        // El NavBar ya está montado desde antes de pagar; sin este aviso no
        // se enteraría del turno nuevo hasta la próxima navegación.
        window.dispatchEvent(new Event('turnos-actualizados'));
    }, [estado]);

    useEffect(() => {
        if (estado !== 'pagado' || !esPestanaOriginal) return;
        const timer = setTimeout(() => setMostrarBotonRespaldo(true), ESPERA_RESPALDO_MS);
        return () => clearTimeout(timer);
    }, [estado, esPestanaOriginal]);

    const handleContinuar = () => {
        if (canalRef.current) {
            canalRef.current.postMessage({ tipo: 'continuar' });
        }
        if (esPestanaOriginal) {
            navigate('/mis-turnos');
        } else {
            window.close();
        }
    };

    const contenidoPorEstado = {
        cargando: {
            titulo: 'Esperando tu pago...',
            texto: esPestanaOriginal
                ? 'Completá el pago en la pestaña de Mercado Pago que se abrió. En cuanto lo confirmes, esta pantalla se va a actualizar sola.'
                : 'Completá el pago acá. Cuando termines, esta pestaña se cierra sola.'
        },
        pagado: {
            titulo: '¡Reserva confirmada! 🎉',
            texto: esPestanaOriginal
                ? 'Hacé clic en "Ver mis reservas" en la otra pestaña para continuar.'
                : 'Hacé clic en "Ver mis reservas" para continuar.'
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

                    {estado === 'pagado' && !esPestanaOriginal && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={handleContinuar}>
                                Ver mis reservas
                            </button>
                        </div>
                    )}

                    {estado === 'pagado' && esPestanaOriginal && mostrarBotonRespaldo && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={handleContinuar}>
                                Ver mis reservas
                            </button>
                        </div>
                    )}

                    {estado !== 'cargando' && estado !== 'pagado' && esPestanaOriginal && (
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

                    {estado !== 'cargando' && estado !== 'pagado' && !esPestanaOriginal && (
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
